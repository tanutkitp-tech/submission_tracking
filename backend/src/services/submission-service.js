const fs = require('node:fs/promises');
const db = require('../config/database');
const HttpError = require('../utils/http-error');
const previewContentType = require('../utils/preview-content-type');
const files = require('./submission-files');

async function submit(studentId, assignmentId, file) {
  const originalName = files.safeOriginalName(file.originalname);
  const storageKey = await files.store(file.buffer);
  let connection;
  let oldStorageKey = null;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [eligible] = await connection.execute(
      `SELECT a.id, a.due_at, (a.due_at <= CURRENT_TIMESTAMP) AS deadline_passed FROM assignments a
       JOIN enrollments e ON e.course_id = a.course_id
       WHERE a.id = ? AND a.status = 'PUBLISHED' AND e.student_id = ?
         AND e.enrollment_status = 'APPROVED' FOR UPDATE`,
      [assignmentId, studentId],
    );
    if (!eligible.length) throw new HttpError(404, 'Assignment not found or student is not enrolled in its course');
    if (Boolean(Number(eligible[0].deadline_passed))) {
      throw new HttpError(409, 'Submission deadline has passed');
    }

    const [existing] = await connection.execute(
      'SELECT id, file_storage_key FROM submissions WHERE assignment_id = ? AND student_id = ? FOR UPDATE',
      [assignmentId, studentId],
    );
    oldStorageKey = existing[0]?.file_storage_key || null;
    const status = 'SUBMITTED';

    if (existing.length) {
      await connection.execute(
        `UPDATE submissions SET status = ?, submitted_at = CURRENT_TIMESTAMP,
         remarks = NULL, score = NULL, file_storage_key = ?, file_original_name = ?,
         file_mime_type = ?, file_size = ? WHERE id = ?`,
        [status, storageKey, originalName, (file.mimetype || 'application/octet-stream').slice(0, 150), file.size, existing[0].id],
      );
    } else {
      await connection.execute(
        `INSERT INTO submissions
         (assignment_id, student_id, status, file_storage_key, file_original_name, file_mime_type, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [assignmentId, studentId, status, storageKey, originalName, (file.mimetype || 'application/octet-stream').slice(0, 150), file.size],
      );
    }
    const [rows] = await connection.execute(
      'SELECT assignment_id, status, submitted_at, file_original_name, file_size, score, remarks FROM submissions WHERE assignment_id = ? AND student_id = ?',
      [assignmentId, studentId],
    );
    await connection.commit();
    if (oldStorageKey && oldStorageKey !== storageKey) await files.remove(oldStorageKey).catch(() => {});
    return rows[0];
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    await files.remove(storageKey).catch(() => {});
    throw error;
  } finally {
    connection?.release();
  }
}

async function getTeacherFile(teacherId, assignmentId, studentId) {
  const [rows] = await db.execute(
    `SELECT sub.file_storage_key, sub.file_original_name
     FROM assignments a JOIN courses c ON c.id = a.course_id
     JOIN submissions sub ON sub.assignment_id = a.id
     WHERE a.id = ? AND sub.student_id = ? AND a.created_by = ? AND c.teacher_id = ?`,
    [assignmentId, studentId, teacherId, teacherId],
  );
  if (!rows.length) {
    const [assignment] = await db.execute('SELECT id FROM assignments WHERE id = ?', [assignmentId]);
    if (!assignment.length) throw new HttpError(404, 'Assignment not found');
    const [owned] = await db.execute(
      'SELECT a.id FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.id = ? AND a.created_by = ? AND c.teacher_id = ?',
      [assignmentId, teacherId, teacherId],
    );
    if (!owned.length) throw new HttpError(403, 'You cannot access submissions for this assignment');
    throw new HttpError(404, 'Submission file not found');
  }
  if (!rows[0].file_storage_key) throw new HttpError(404, 'Submission has no uploaded file');
  const filePath = files.resolve(rows[0].file_storage_key);
  if (!filePath) throw new HttpError(404, 'Submission file not found');
  try { await fs.access(filePath); } catch { throw new HttpError(404, 'Submission file is missing from server storage'); }
  return { path: filePath, name: rows[0].file_original_name || 'submission' };
}

async function getTeacherPreview(teacherId, assignmentId, studentId) {
  const file = await getTeacherFile(teacherId, assignmentId, studentId);
  const buffer = await fs.readFile(file.path);
  const contentType = previewContentType(buffer);
  if (!contentType) throw new HttpError(415, 'Inline preview is available only for PDF and common image files');
  return { buffer, contentType };
}

async function grade(teacherId, assignmentId, studentId, values) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [owned] = await connection.execute(
      'SELECT a.id, a.max_score FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.id = ? AND a.created_by = ? AND c.teacher_id = ? FOR UPDATE',
      [assignmentId, teacherId, teacherId],
    );
    if (!owned.length) {
      const [exists] = await connection.execute('SELECT id FROM assignments WHERE id = ?', [assignmentId]);
      throw new HttpError(exists.length ? 403 : 404, exists.length ? 'You cannot review submissions for this assignment' : 'Assignment not found');
    }
    const [existing] = await connection.execute(
      'SELECT id, score, remarks FROM submissions WHERE assignment_id = ? AND student_id = ? FOR UPDATE',
      [assignmentId, studentId],
    );
    if (!existing.length) throw new HttpError(404, 'Submission not found');
    const score = values.score;
    if (score == null) throw new HttpError(400, 'Score is required to mark submission as reviewed');
    if (Number(score) > Number(owned[0].max_score)) {
      throw new HttpError(400, `Score cannot exceed the assignment maximum of ${owned[0].max_score}`);
    }
    const remarks = Object.hasOwn(values, 'remarks') ? values.remarks : existing[0].remarks;
    await connection.execute(
      "UPDATE submissions SET status = 'REVIEWED', score = ?, remarks = ? WHERE id = ?",
      [score, remarks, existing[0].id],
    );
    const [rows] = await connection.execute(
      'SELECT assignment_id, student_id, status, score, remarks, submitted_at, file_original_name, file_size FROM submissions WHERE id = ?',
      [existing[0].id],
    );
    await connection.commit();
    return rows[0];
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { submit, getTeacherFile, getTeacherPreview, grade };
