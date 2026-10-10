const db = require('../config/database');
const HttpError = require('../utils/http-error');

async function listPublic() {
  const [rows] = await db.execute('SELECT c.id,c.course_code,c.course_name,c.description,c.teacher_id,t.full_name AS teacher_name FROM courses c JOIN teachers t ON t.id=c.teacher_id ORDER BY c.id DESC');
  return rows;
}
async function listMine(teacherId, { page, limit, offset }) {
  const [counts] = await db.execute('SELECT COUNT(*) AS total FROM courses WHERE teacher_id=?', [teacherId]);
  const [rows] = await db.execute('SELECT id,course_code,course_name,description,teacher_id FROM courses WHERE teacher_id=? ORDER BY id DESC LIMIT ? OFFSET ?', [teacherId, limit, offset]);
  const total = Number(counts[0].total);
  return { rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
async function getById(id) {
  const [rows] = await db.execute('SELECT c.id,c.course_code,c.course_name,c.description,c.teacher_id,t.full_name AS teacher_name FROM courses c JOIN teachers t ON t.id=c.teacher_id WHERE c.id=?', [id]);
  if (!rows.length) throw new HttpError(404, 'Course not found');
  return rows[0];
}
async function create(teacherId, course) {
  const [result] = await db.execute('INSERT INTO courses (course_code,course_name,description,teacher_id) VALUES (?,?,?,?)', [course.courseCode, course.courseName, course.description, teacherId]);
  return { id: result.insertId, course_code: course.courseCode, course_name: course.courseName, description: course.description, teacher_id: teacherId };
}
async function update(teacherId, id, course) {
  const [result] = await db.execute('UPDATE courses SET course_code=?,course_name=?,description=? WHERE id=? AND teacher_id=?', [course.courseCode, course.courseName, course.description, id, teacherId]);
  if (!result.affectedRows) {
    const [owned] = await db.execute('SELECT id FROM courses WHERE id=? AND teacher_id=?', [id, teacherId]);
    if (!owned.length) {
      const [exists] = await db.execute('SELECT id FROM courses WHERE id=?', [id]);
      throw new HttpError(exists.length ? 403 : 404, exists.length ? 'You cannot modify this course' : 'Course not found');
    }
  }
  return { id, course_code: course.courseCode, course_name: course.courseName, description: course.description, teacher_id: teacherId };
}
async function remove(teacherId, id) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [owned] = await connection.execute('SELECT id FROM courses WHERE id=? AND teacher_id=? FOR UPDATE', [id, teacherId]);
    if (!owned.length) {
      const [exists] = await connection.execute('SELECT id FROM courses WHERE id=?', [id]);
      throw new HttpError(exists.length ? 403 : 404, exists.length ? 'You cannot delete this course' : 'Course not found');
    }
    const [dependencies] = await connection.execute('SELECT (SELECT COUNT(*) FROM assignments WHERE course_id=?) AS assignments,(SELECT COUNT(*) FROM enrollments WHERE course_id=?) AS enrollments', [id, id]);
    if (Number(dependencies[0].assignments) || Number(dependencies[0].enrollments)) throw new HttpError(409, 'Course has assignments or enrollments and cannot be deleted');
    await connection.execute('DELETE FROM courses WHERE id=? AND teacher_id=?', [id, teacherId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

module.exports = { listPublic, listMine, getById, create, update, remove };
