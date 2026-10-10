const db = require('../config/database');
const HttpError = require('../utils/http-error');

async function listCourses(studentId) {
  const [rows] = await db.execute(
    `SELECT c.id, c.course_code, c.course_name, c.description,
      e.enrollment_status,
      CASE WHEN e.enrollment_status = 'APPROVED' THEN 1 ELSE 0 END AS is_enrolled
     FROM courses c
     LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
     ORDER BY c.course_code`,
    [studentId],
  );
  return rows;
}

async function enroll(studentId, courseId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [courses] = await connection.execute('SELECT id, course_code, course_name FROM courses WHERE id = ? FOR UPDATE', [courseId]);
    if (!courses.length) throw new HttpError(404, 'Course not found');
    const [existing] = await connection.execute('SELECT id, enrollment_status FROM enrollments WHERE course_id = ? AND student_id = ? FOR UPDATE', [courseId, studentId]);
    if (existing[0]?.enrollment_status === 'APPROVED') throw new HttpError(409, 'Student is already enrolled in this course');
    if (existing[0]?.enrollment_status === 'PENDING') throw new HttpError(409, 'Enrollment request is already pending');

    let enrollmentId;
    if (existing.length) {
      enrollmentId = existing[0].id;
      await connection.execute(
        "UPDATE enrollments SET enrollment_status = 'PENDING', enrolled_at = CURRENT_TIMESTAMP, reviewed_at = NULL WHERE id = ?",
        [enrollmentId],
      );
    } else {
      const [result] = await connection.execute(
        "INSERT INTO enrollments (course_id, student_id, enrollment_status) VALUES (?, ?, 'PENDING')",
        [courseId, studentId],
      );
      enrollmentId = result.insertId;
    }
    await connection.commit();
    return { id: enrollmentId, course_id: courseId, ...courses[0], enrollment_status: 'PENDING' };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function listAssignments(studentId) {
  const [rows] = await db.execute(
    `SELECT a.id, a.course_id, a.title, a.description, a.due_at, a.max_score,
      a.status AS assignment_status, c.course_code, c.course_name,
      sub.status AS submission_status, sub.submitted_at, sub.remarks,
      sub.file_original_name, sub.file_size, sub.score
     FROM enrollments e
     JOIN assignments a ON a.course_id = e.course_id AND a.status = 'PUBLISHED'
     JOIN courses c ON c.id = a.course_id
     LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = e.student_id
     WHERE e.student_id = ? AND e.enrollment_status = 'APPROVED'
     ORDER BY a.due_at ASC, a.id ASC`,
    [studentId],
  );
  return rows;
}

async function getAssignment(studentId, assignmentId) {
  const [rows] = await db.execute(
    `SELECT a.id, a.course_id, a.title, a.description, a.due_at, a.max_score,
      a.status AS assignment_status, c.course_code, c.course_name,
      sub.status AS submission_status, sub.submitted_at, sub.remarks,
      sub.file_original_name, sub.file_size, sub.score
     FROM enrollments e
     JOIN assignments a ON a.course_id = e.course_id AND a.status = 'PUBLISHED'
     JOIN courses c ON c.id = a.course_id
     LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = e.student_id
     WHERE e.student_id = ? AND a.id = ? AND e.enrollment_status = 'APPROVED'`,
    [studentId, assignmentId],
  );
  if (!rows.length) throw new HttpError(404, 'Assignment not found or student is not enrolled in its course');
  return rows[0];
}

module.exports = { listCourses, enroll, listAssignments, getAssignment };
