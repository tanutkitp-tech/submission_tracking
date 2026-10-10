import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:3000/api";

function formatDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function App() {
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [coursesResponse, assignmentsResponse] =
          await Promise.all([
            fetch(`${API_URL}/courses`),
            fetch(`${API_URL}/assignments`),
          ]);

        if (!coursesResponse.ok || !assignmentsResponse.ok) {
          throw new Error("ไม่สามารถโหลดข้อมูลจากเซิร์ฟเวอร์ได้");
        }

        const coursesResult = await coursesResponse.json();
        const assignmentsResult = await assignmentsResponse.json();

        if (!coursesResult.success || !assignmentsResult.success) {
          throw new Error("เซิร์ฟเวอร์ส่งข้อมูลกลับมาไม่สำเร็จ");
        }

        setCourses(coursesResult.data || []);
        setAssignments(assignmentsResult.data || []);
      } catch (err) {
        setError(
          "โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบว่า Backend และ MySQL ทำงานอยู่"
        );
        console.error("Load data error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#home">
          <span className="brand-icon">ST</span>
          <span>SUBMISSION TRACKING</span>
        </a>

        <span className="public-label">ระบบสำหรับนิสิต</span>
      </header>

      <main id="home" className="main-content">
        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">STUDENT ASSIGNMENT PORTAL</p>
            <h1>
              ระบบติดตามสถานะ
              <br />
              การส่งงานของนิสิต
            </h1>
            <p className="hero-description">
              ตรวจสอบรายวิชา รายละเอียดงาน และกำหนดส่งงาน
              ได้ในที่เดียว
            </p>
          </div>

          <div className="hero-decoration" aria-hidden="true">
            <div className="decoration-card">
              <span className="decoration-check">✓</span>
              <span>ติดตามงานได้ง่ายขึ้น</span>
            </div>
          </div>
        </section>

        <section className="stats">
          <div className="stat-card">
            <span className="stat-label">รายวิชาทั้งหมด</span>
            <strong>{loading ? "..." : courses.length}</strong>
            <span className="stat-note">รายวิชาในระบบ</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">งานที่เปิดให้ดู</span>
            <strong>{loading ? "..." : assignments.length}</strong>
            <span className="stat-note">งานที่เผยแพร่แล้ว</span>
          </div>
        </section>

        {error && (
          <section className="message error-message">
            <strong>เกิดข้อผิดพลาด</strong>
            <p>{error}</p>
            <button
              className="retry-button"
              onClick={() => window.location.reload()}
            >
              ลองโหลดใหม่
            </button>
          </section>
        )}

        <section className="content-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">COURSES</p>
              <h2>รายวิชา</h2>
            </div>
            <span className="section-count">
              {courses.length} รายวิชา
            </span>
          </div>

          {loading ? (
            <div className="message">กำลังโหลดข้อมูลรายวิชา...</div>
          ) : courses.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">▤</span>
              <h3>ยังไม่มีรายวิชา</h3>
              <p>
                เมื่อมีการเพิ่มรายวิชาในฐานข้อมูล
                รายวิชาจะแสดงในส่วนนี้
              </p>
            </div>
          ) : (
            <div className="course-grid">
              {courses.map((course) => (
                <article className="course-card" key={course.id}>
                  <div className="course-card-top">
                    <span className="course-icon">▤</span>
                    <span className="course-code">
                      {course.course_code}
                    </span>
                  </div>

                  <h3>{course.course_name}</h3>

                  <p className="course-description">
                    {course.description || "ไม่มีรายละเอียดรายวิชา"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ASSIGNMENTS</p>
              <h2>งานที่เผยแพร่แล้ว</h2>
            </div>
            <span className="section-count">
              {assignments.length} งาน
            </span>
          </div>

          {loading ? (
            <div className="message">กำลังโหลดรายการงาน...</div>
          ) : assignments.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">✓</span>
              <h3>ยังไม่มีงานที่เผยแพร่</h3>
              <p>
                งานจะแสดงที่นี่เมื่ออาจารย์เผยแพร่ให้นิสิตดู
              </p>
            </div>
          ) : (
            <div className="assignment-list">
              {assignments.map((assignment) => (
                <article className="assignment-card" key={assignment.id}>
                  <div className="assignment-icon">📝</div>

                  <div className="assignment-info">
                    <span className="assignment-course">
                      {assignment.course_code} · {assignment.course_name}
                    </span>
                    <h3>{assignment.title}</h3>
                    <p>
                      {assignment.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                    </p>
                    <span className="due-date">
                      กำหนดส่ง: {formatDate(assignment.due_at)}
                    </span>
                  </div>

                  <span className="status-pill">เผยแพร่แล้ว</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>ระบบติดตามสถานะการส่งงานของนิสิต</p>
        <span>Student Assignment Tracking System</span>
      </footer>
    </div>
  );
}

export default App;