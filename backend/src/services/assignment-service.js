const db = require('../config/database');
const HttpError = require('../utils/http-error');

async function listPublic() {
  const [rows] = await db.execute("SELECT a.id,a.course_id,a.title,a.description,a.due_at,a.status,c.course_code,c.course_name FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.status='PUBLISHED' ORDER BY a.due_at ASC");
  return rows;
}
async function listMine(teacherId, { page, limit, offset }) {
  const ownerFilter = 'a.created_by=? AND c.teacher_id=?';
  const [counts] = await db.execute(`SELECT COUNT(*) AS total FROM assignments a JOIN courses c ON c.id=a.course_id WHERE ${ownerFilter}`, [teacherId, teacherId]);
  const [rows] = await db.execute(`SELECT a.id,a.course_id,a.title,a.description,a.due_at,a.status,c.course_code,c.course_name FROM assignments a JOIN courses c ON c.id=a.course_id WHERE ${ownerFilter} ORDER BY a.due_at ASC LIMIT ? OFFSET ?`, [teacherId, teacherId, limit, offset]);
  const total = Number(counts[0].total);
  return { rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
async function getPublicById(id) {
  const [rows] = await db.execute("SELECT a.id,a.course_id,a.title,a.description,a.due_at,a.status,c.course_code,c.course_name FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id=? AND a.status='PUBLISHED'", [id]);
  if (!rows.length) throw new HttpError(404, 'Assignment not found');
  return rows[0];
}
async function create(teacherId, item) {
  const [courses] = await db.execute('SELECT id FROM courses WHERE id=? AND teacher_id=?', [item.courseId, teacherId]);
  if (!courses.length) throw new HttpError(404, 'Course not found');
  const [result] = await db.execute('INSERT INTO assignments (course_id,title,description,due_at,status,created_by) VALUES (?,?,?,?,?,?)', [item.courseId, item.title, item.description, item.dueAt, item.status, teacherId]);
  return { id: result.insertId, ...item, due_at: item.dueAt, created_by: teacherId };
}
async function update(teacherId, id, item) {
  const [owned] = await db.execute('SELECT a.id FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id=? AND c.teacher_id=? AND a.created_by=?', [id, teacherId, teacherId]);
  if (!owned.length) {
    const [exists] = await db.execute('SELECT id FROM assignments WHERE id=?', [id]);
    throw new HttpError(exists.length ? 403 : 404, exists.length ? 'You cannot modify this assignment' : 'Assignment not found');
  }
  const [course] = await db.execute('SELECT id FROM courses WHERE id=? AND teacher_id=?', [item.courseId, teacherId]);
  if (!course.length) throw new HttpError(404, 'Course not found');
  await db.execute('UPDATE assignments SET course_id=?,title=?,description=?,due_at=?,status=? WHERE id=? AND created_by=?', [item.courseId, item.title, item.description, item.dueAt, item.status, id, teacherId]);
  return { id, ...item };
}
async function remove(teacherId, id) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [owned] = await connection.execute('SELECT a.id FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id=? AND a.created_by=? AND c.teacher_id=? FOR UPDATE', [id, teacherId, teacherId]);
    if (!owned.length) {
      const [exists] = await connection.execute('SELECT id FROM assignments WHERE id=?', [id]);
      throw new HttpError(exists.length ? 403 : 404, exists.length ? 'You cannot delete this assignment' : 'Assignment not found');
    }
    const [dependencies] = await connection.execute('SELECT COUNT(*) AS submissions FROM submissions WHERE assignment_id=?', [id]);
    if (Number(dependencies[0].submissions)) throw new HttpError(409, 'Assignment has submissions and cannot be deleted');
    await connection.execute('DELETE FROM assignments WHERE id=? AND created_by=?', [id, teacherId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}
async function listSubmissions(teacherId, assignmentId) {
  const [owned] = await db.execute('SELECT a.id FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id=? AND a.created_by=? AND c.teacher_id=?', [assignmentId, teacherId, teacherId]);
  if (!owned.length) {
    const [exists] = await db.execute('SELECT id FROM assignments WHERE id=?', [assignmentId]);
    throw new HttpError(exists.length ? 403 : 404, exists.length ? 'You cannot view submissions for this assignment' : 'Assignment not found');
  }
  const [rows] = await db.execute("SELECT s.id AS student_id,s.student_code,s.full_name,sub.status,sub.submitted_at,sub.remarks FROM enrollments e JOIN students s ON s.id=e.student_id JOIN assignments a ON a.course_id=e.course_id LEFT JOIN submissions sub ON sub.assignment_id=a.id AND sub.student_id=s.id WHERE a.id=? ORDER BY s.student_code", [assignmentId]);
  return rows;
}
async function markReviewed(teacherId, assignmentId, studentId) {
  const [owned] = await db.execute('SELECT a.id FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id=? AND a.created_by=? AND c.teacher_id=?', [assignmentId, teacherId, teacherId]);
  if (!owned.length) {
    const [exists] = await db.execute('SELECT id FROM assignments WHERE id=?', [assignmentId]);
    throw new HttpError(exists.length ? 403 : 404, exists.length ? 'You cannot review submissions for this assignment' : 'Assignment not found');
  }
  const [result] = await db.execute("UPDATE submissions SET status='REVIEWED' WHERE assignment_id=? AND student_id=? AND status IN ('SUBMITTED','LATE')", [assignmentId, studentId]);
  if (!result.affectedRows) {
    const [existing] = await db.execute('SELECT status FROM submissions WHERE assignment_id=? AND student_id=?', [assignmentId, studentId]);
    if (!existing.length) throw new HttpError(404, 'Submission not found');
  }
  return { assignment_id: assignmentId, student_id: studentId, status: 'REVIEWED' };
}

module.exports = { listPublic, listMine, getPublicById, create, update, remove, listSubmissions, markReviewed };
