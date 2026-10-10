const db = require('../config/database');
const HttpError = require('../utils/http-error');

async function listMine(teacherId) {
  const [rows] = await db.execute(
    `SELECT e.course_id, e.student_id, e.enrollment_status, e.enrolled_at AS requested_at, e.reviewed_at,
      c.course_code, c.course_name, s.student_code, s.full_name
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     JOIN students s ON s.id = e.student_id
     WHERE c.teacher_id = ?
     ORDER BY FIELD(e.enrollment_status, 'PENDING', 'APPROVED', 'REJECTED'), e.enrolled_at DESC, s.student_code`,
    [teacherId],
  );
  return rows;
}

async function review(teacherId, courseId, studentId, status) {
  const [owned] = await db.execute('SELECT id FROM courses WHERE id = ? AND teacher_id = ?', [courseId, teacherId]);
  if (!owned.length) {
    const [exists] = await db.execute('SELECT id FROM courses WHERE id = ?', [courseId]);
    throw new HttpError(exists.length ? 403 : 404, exists.length ? 'You cannot review enrollments for this course' : 'Course not found');
  }

  const [result] = await db.execute(
    'UPDATE enrollments SET enrollment_status = ?, reviewed_at = CURRENT_TIMESTAMP WHERE course_id = ? AND student_id = ? AND enrollment_status = \'PENDING\'',
    [status, courseId, studentId],
  );
  if (!result.affectedRows) {
    const [existing] = await db.execute('SELECT enrollment_status FROM enrollments WHERE course_id = ? AND student_id = ?', [courseId, studentId]);
    if (!existing.length) throw new HttpError(404, 'Enrollment request not found');
    throw new HttpError(409, 'Enrollment request has already been reviewed');
  }

  const [rows] = await db.execute(
    `SELECT e.course_id, e.student_id, e.enrollment_status, e.enrolled_at AS requested_at, e.reviewed_at,
      c.course_code, c.course_name, s.student_code, s.full_name
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     JOIN students s ON s.id = e.student_id
     WHERE e.course_id = ? AND e.student_id = ?`,
    [courseId, studentId],
  );
  return rows[0];
}

module.exports = { listMine, review };
