import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
const STORAGE_KEY = "submission-tracking-student-session";

class StudentApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "StudentApiError";
    this.status = status;
  }
}

async function apiRequest(path, { token, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body != null && !isFormData && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(API_BASE_URL + path, { ...options, headers });
  } catch {
    throw new StudentApiError("ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new StudentApiError("ระบบตอบกลับไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง", response.status);
  }
  if (!response.ok || payload?.success !== true) {
    throw new StudentApiError(payload?.message || "คำขอไม่สำเร็จ กรุณาลองใหม่", response.status);
  }
  return payload;
}

function readSavedSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved && typeof saved.token === "string" && saved.token ? saved : null;
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "ไม่ระบุกำหนดส่ง";
  const hasTimezone = typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const normalized = typeof value === "string" ? value.replace(" ", "T") : value;
  const date = new Date(hasTimezone ? normalized : `${normalized}+07:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
}

function deadlineTimestamp(value) {
  if (!value) return Number.NaN;
  const normalized = typeof value === "string" && !value.includes("T")
    ? value.replace(" ", "T")
    : value;
  const hasTimezone = typeof normalized === "string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  return new Date(hasTimezone ? normalized : `${normalized}+07:00`).getTime();
}

function statusText(status) {
  const labels = {
    SUBMITTED: "ส่งแล้ว",
    LATE: "ส่งล่าช้า",
    REVIEWED: "ตรวจแล้ว",
  };
  return labels[status] || (status ? "ไม่ทราบสถานะ" : "ยังไม่ได้ส่งงาน");
}

function studentFriendlyError(error) {
  const status = Number(error?.status) || 0;
  if (status === 400) return "ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่";
  if (status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
  if (status === 403) return "คุณไม่มีสิทธิ์ดำเนินการนี้";
  if (status === 404) return "ไม่พบข้อมูลที่ต้องการ กรุณารีเฟรชแล้วลองใหม่";
  if (status === 409) return "ไม่สามารถดำเนินการได้ในขณะนี้ กรุณารีเฟรชแล้วลองใหม่";
  if (status === 413) return "ไฟล์มีขนาดเกินขีดจำกัด 25 MB";
  if (status === 429) return "มีการส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (status >= 500) return "ระบบขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง";
  if (status) return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
  if (error?.name === "StudentApiError" && error.message) return error.message;
  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

function isEnrollmentApproved(course) {
  return course?.enrollment_status === "APPROVED";
}

function hasEnrollmentStatus(course) {
  return Object.prototype.hasOwnProperty.call(course || {}, "enrollment_status");
}

function InfoMessage({ type = "warning", title, children }) {
  return (
    <div className={`message message-${type}`} role={type === "error" ? "alert" : "status"}>
      <div><strong>{title}</strong><p>{children}</p></div>
    </div>
  );
}

function StudentPortal({ onTeacherPortal }) {
  const [savedSession] = useState(() => readSavedSession());
  const [sessionStatus, setSessionStatus] = useState(savedSession ? "checking" : "guest");
  const [session, setSession] = useState(savedSession);
  const [page, setPage] = useState("assignments");
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [assignmentDetail, setAssignmentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [currentTime, setCurrentTime] = useState(null);
  const [enrollingCourseId, setEnrollingCourseId] = useState(null);
  const [enrollmentNotice, setEnrollmentNotice] = useState("");
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const endSession = useCallback((notice = "") => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setSessionStatus("guest");
    setPage("assignments");
    setSelectedCourseId(null);
    setSelectedAssignmentId(null);
    setAssignmentDetail(null);
    setAssignments([]);
    setCourses([]);
    setAuthMode("login");
    setAuthError("");
    setAuthSuccess(notice);
  }, []);

  useEffect(() => {
    if (!savedSession?.token) return undefined;
    let active = true;
    apiRequest("/auth/student/me", { token: savedSession.token })
      .then((payload) => {
        if (!active) return;
        if (!payload.data || typeof payload.data !== "object") throw new StudentApiError("ไม่สามารถตรวจสอบบัญชีได้ กรุณาเข้าสู่ระบบใหม่");
        const verified = { token: savedSession.token, student: payload.data };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(verified));
        setSession(verified);
        setSessionStatus("authenticated");
      })
      .catch((error) => {
        if (!active) return;
        localStorage.removeItem(STORAGE_KEY);
        setSession(null);
        setSessionStatus("guest");
        if (error.status !== 401) setAuthError(studentFriendlyError(error));
        else setAuthSuccess("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      });
    return () => { active = false; };
  }, [savedSession]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !session?.token) return undefined;
    let active = true;
    const controller = new AbortController();
    async function loadStudentData() {
      setDataLoading(true);
      setDataError("");
      try {
        const [assignmentPayload, coursePayload] = await Promise.all([
          apiRequest("/student/assignments", { token: session.token, signal: controller.signal }),
          apiRequest("/student/courses", { token: session.token, signal: controller.signal }),
        ]);
        if (!Array.isArray(assignmentPayload.data) || !Array.isArray(coursePayload.data)) {
          throw new StudentApiError("โหลดรายการงานไม่สำเร็จ กรุณาลองใหม่");
        }
        if (active) {
          const approvedCourseIds = new Set(
            coursePayload.data.filter(isEnrollmentApproved).map((course) => String(course.id)),
          );
          setAssignments(assignmentPayload.data.filter((assignment) => approvedCourseIds.has(String(assignment.course_id))));
          setCourses(coursePayload.data);
          if (coursePayload.data.some((course) => !hasEnrollmentStatus(course))) {
            setDataError("ไม่สามารถตรวจสอบสถานะการลงทะเบียนได้ กรุณาลองใหม่ภายหลัง");
          }
        }
      } catch (error) {
        if (!active || error.name === "AbortError") return;
        if (error.status === 401) endSession("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
        else setDataError(studentFriendlyError(error));
      } finally {
        if (active) setDataLoading(false);
      }
    }
    void loadStudentData();
    return () => { active = false; controller.abort(); };
  }, [sessionStatus, session?.token, refreshVersion, endSession]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || page !== "detail" || !selectedAssignmentId || !session?.token) return undefined;
    let active = true;
    const controller = new AbortController();
    async function loadDetail() {
      setDetailLoading(true);
      setDetailError("");
      setAssignmentDetail(null);
      try {
        const payload = await apiRequest(`/student/assignments/${encodeURIComponent(selectedAssignmentId)}`, {
          token: session.token,
          signal: controller.signal,
        });
        if (!payload.data || typeof payload.data !== "object") throw new StudentApiError("โหลดรายละเอียดงานไม่สำเร็จ กรุณาลองใหม่");
        if (active) setAssignmentDetail(payload.data);
      } catch (error) {
        if (!active || error.name === "AbortError") return;
        if (error.status === 401) endSession("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
        else setDetailError(studentFriendlyError(error));
      } finally {
        if (active) setDetailLoading(false);
      }
    }
    void loadDetail();
    return () => { active = false; controller.abort(); };
  }, [sessionStatus, session?.token, page, selectedAssignmentId, endSession]);

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const pageAssignments = page === "course" && selectedCourseId != null
      ? assignments.filter((item) => String(item.course_id) === String(selectedCourseId))
      : assignments;
    if (!query) return pageAssignments;
    return pageAssignments.filter((item) =>
      [item.title, item.course_code, item.course_name, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(query)),
    );
  }, [assignments, page, search, selectedCourseId]);

  const selectedCourse = courses.find((course) => String(course.id) === String(selectedCourseId));
  const deadlineAt = deadlineTimestamp(assignmentDetail?.due_at);
  const deadlinePassed = Number.isFinite(deadlineAt) && currentTime != null && currentTime >= deadlineAt;
  const selectedCourseAssignments = selectedCourseId == null
    ? []
    : assignments.filter((item) => String(item.course_id) === String(selectedCourseId));

  async function submitAuth(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    const isRegister = authMode === "register";
    if (isRegister && values.password !== values.password_confirm) {
      setAuthError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      setAuthLoading(false);
      return;
    }
    const body = isRegister
      ? { student_code: values.student_code, full_name: values.full_name, password: values.password }
      : { student_code: values.student_code, password: values.password };
    try {
      const payload = await apiRequest(isRegister ? "/auth/student/register" : "/auth/student/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!payload.data?.token || !payload.data?.student) throw new StudentApiError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      const nextSession = { token: payload.data.token, student: payload.data.student };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setSessionStatus("authenticated");
      setPage("assignments");
      setAuthSuccess(isRegister ? "สร้างบัญชีและเข้าสู่ระบบสำเร็จ" : "เข้าสู่ระบบสำเร็จ");
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      const message = error.status === 401
        ? "รหัสนิสิตหรือรหัสผ่านไม่ถูกต้อง"
        : error.status === 409
          ? "รหัสนิสิตนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบแทน"
          : error.status === 400
            ? "ตรวจสอบรหัสนิสิต ชื่อ และรหัสผ่าน (รหัสผ่านอย่างน้อย 8 ตัวอักษร)"
            : studentFriendlyError(error);
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function enrollInCourse(course) {
    if (!session?.token) return;
    if (!hasEnrollmentStatus(course)) {
      setDataError("ขณะนี้ไม่สามารถส่งคำขอลงทะเบียนได้ กรุณาลองใหม่ภายหลัง");
      return;
    }
    setEnrollingCourseId(course.id);
    setEnrollmentNotice("");
    setDataError("");
    try {
      const payload = await apiRequest("/student/enrollments", {
        method: "POST",
        token: session.token,
        body: JSON.stringify({ course_id: course.id }),
      });
      if (payload.data?.enrollment_status !== "PENDING") {
        throw new StudentApiError("ส่งคำขอลงทะเบียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
      setEnrollmentNotice(`ส่งคำขอลงทะเบียน ${course.course_code} แล้ว รออาจารย์อนุมัติ`);
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      if (error.status === 401) endSession("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      else if (error.status === 409) setDataError("มีคำขอลงทะเบียนรายวิชานี้อยู่แล้วหรือได้รับอนุมัติแล้ว กดรีเฟรชเพื่อตรวจสอบสถานะ");
      else setDataError(error.status === 404
        ? "ไม่พบรายวิชาที่เลือก กรุณารีเฟรชรายการ"
        : studentFriendlyError(error));
    } finally {
      setEnrollingCourseId(null);
    }
  }

  async function changeStudentPassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setPasswordError("");
    if (values.new_password !== values.new_password_confirm) {
      setPasswordError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
      return;
    }
    setPasswordSaving(true);
    try {
      const payload = await apiRequest("/auth/student/password", {
        method: "PATCH",
        token: session?.token,
        body: JSON.stringify({ current_password: values.current_password, new_password: values.new_password }),
      });
      if (payload.data?.updated !== true) throw new StudentApiError("เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setPasswordDialog(false);
      setAuthSuccess("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
      form.reset();
    } catch (error) {
      if (error.status === 401) endSession("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      setPasswordError(error.message === "Current password is incorrect"
        ? "รหัสผ่านปัจจุบันไม่ถูกต้อง"
        : error.status === 400
          ? "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร และไม่ซ้ำกับรหัสเดิม"
          : studentFriendlyError(error));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function submitAssignmentFile(event) {
    event.preventDefault();
    if (Date.now() >= deadlineTimestamp(assignmentDetail?.due_at)) {
      setCurrentTime(Date.now());
      setUploadError("เลยกำหนดส่งแล้ว ระบบไม่รับไฟล์เพิ่มเติม");
      return;
    }
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!file || typeof file === "string" || !file.name) {
      setUploadError("เลือกไฟล์ที่ต้องการส่งก่อน");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("ไฟล์มีขนาดเกิน 25 MB");
      return;
    }
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      const body = new FormData();
      body.append("file", file);
      const payload = await apiRequest(`/student/assignments/${encodeURIComponent(assignmentDetail.id)}/submission`, {
        method: "POST",
        token: session?.token,
        body,
      });
      if (!payload.data?.file_original_name || !payload.data?.status) {
        throw new StudentApiError("ส่งไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
      setAssignmentDetail((current) => current ? ({
        ...current,
        submission_status: payload.data.status,
        submitted_at: payload.data.submitted_at,
        file_original_name: payload.data.file_original_name,
        file_size: payload.data.file_size,
        score: payload.data.score,
        remarks: payload.data.remarks,
      }) : current);
      setUploadSuccess(`ส่งไฟล์ ${payload.data.file_original_name} สำเร็จ`);
      setRefreshVersion((value) => value + 1);
      form.reset();
    } catch (error) {
      if (error.status === 401) endSession("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
      setUploadError(error.status === 409 && error.message === "Submission deadline has passed"
        ? "เลยกำหนดส่งแล้ว ระบบไม่รับไฟล์เพิ่มเติม"
        : error.status === 413
          ? "ไฟล์มีขนาดเกินขีดจำกัด 25 MB"
        : studentFriendlyError(error));
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    const updateClock = () => setCurrentTime(Date.now());
    updateClock();
    const timer = window.setInterval(updateClock, 5000);
    return () => window.clearInterval(timer);
  }, []);

  function showAssignments() {
    setPage("assignments");
    setSelectedCourseId(null);
    setSelectedAssignmentId(null);
    setAssignmentDetail(null);
  }

  function showCourses() {
    setPage("courses");
    setSelectedCourseId(null);
    setSelectedAssignmentId(null);
    setAssignmentDetail(null);
    setSearch("");
  }

  function openCourse(course) {
    if (!isEnrollmentApproved(course)) {
      setDataError("ยังเข้ารายวิชานี้ไม่ได้ ต้องรออาจารย์อนุมัติคำขอลงทะเบียนก่อน");
      return;
    }
    setSelectedCourseId(course.id);
    setSearch("");
    setEnrollmentNotice("");
    setPage("course");
  }

  function backFromAssignment() {
    if (selectedCourseId != null) {
      setPage("course");
      setSelectedAssignmentId(null);
      setAssignmentDetail(null);
      return;
    }
    showAssignments();
  }

  function openAssignment(assignment) {
    const course = courses.find((item) => String(item.id) === String(assignment.course_id));
    if (!isEnrollmentApproved(course)) {
      setDataError("ยังดูงานนี้ไม่ได้ ต้องได้รับอนุมัติการลงทะเบียนรายวิชาก่อน");
      return;
    }
    setUploadError("");
    setUploadSuccess("");
    setSelectedAssignmentId(assignment.id);
    setPage("detail");
  }

  function switchAuthMode(mode) {
    setAuthMode(mode);
    setAuthError("");
    setAuthSuccess("");
  }

  return (
    <div className="app-shell auth-shell student-shell">
      <header className="topbar auth-topbar student-topbar">
        <a className="brand" href="#/student" aria-label="ระบบติดตามการส่งงาน">
          <span className="brand-icon">ST</span>
          <span className="brand-name">SUBMISSION TRACKING</span>
        </a>
        <div className="portal-actions">
          <span className="topbar-tag">พื้นที่สำหรับนิสิต</span>
          <button className="button button-secondary portal-switch-button" type="button" onClick={onTeacherPortal}>หน้าสำหรับอาจารย์</button>
          {sessionStatus === "authenticated" && (
            <>
              <button className="button button-secondary" type="button" onClick={() => { setPasswordError(""); setPasswordDialog(true); }}>เปลี่ยนรหัสผ่าน</button>
              <button className="button button-quiet" type="button" onClick={() => endSession()}>ออกจากระบบ</button>
            </>
          )}
        </div>
      </header>

      {sessionStatus === "checking" ? (
        <main className="student-checking"><div className="loading-state"><span className="spinner" />กำลังตรวจสอบบัญชีนิสิต…</div></main>
      ) : sessionStatus === "guest" ? (
        <main className="auth-main student-auth-main" id="student-login">
          <section className="auth-intro">
            <span className="intro-mark" aria-hidden="true">S</span>
            <p className="eyebrow">พื้นที่นิสิต</p>
            <h1>ติดตามงาน<br />และกำหนดส่ง</h1>
            <p>เข้าสู่ระบบเพื่อดูงานและกำหนดส่งในรายวิชาที่ลงทะเบียนไว้</p>
            <div className="auth-points">
              <span><i>01</i> สมัครด้วยรหัสนิสิต</span>
              <span><i>02</i> ลงทะเบียนรายวิชา</span>
              <span><i>03</i> ดูงานและสถานะของบัญชีตนเอง</span>
            </div>
          </section>

          <section className="login-card student-login-card" aria-labelledby="student-login-title">
            <div className="login-card-heading">
              <span className="login-icon" aria-hidden="true">S</span>
              <p className="eyebrow">บัญชีนิสิต</p>
              <h2 id="student-login-title">{authMode === "login" ? "เข้าสู่ระบบนิสิต" : "สมัครบัญชีนิสิต"}</h2>
              <p>ใช้รหัสนิสิตและรหัสผ่าน</p>
            </div>

            <div className="student-auth-tabs" role="tablist" aria-label="เลือกรูปแบบบัญชีนิสิต">
              <button className={authMode === "login" ? "is-active" : ""} type="button" role="tab" aria-selected={authMode === "login"} onClick={() => switchAuthMode("login")}>เข้าสู่ระบบ</button>
              <button className={authMode === "register" ? "is-active" : ""} type="button" role="tab" aria-selected={authMode === "register"} onClick={() => switchAuthMode("register")}>สมัครบัญชีใหม่</button>
            </div>

            {authSuccess && <InfoMessage type="success" title="สำเร็จ">{authSuccess}</InfoMessage>}
            {authError && <InfoMessage type="error" title={authMode === "login" ? "เข้าสู่ระบบไม่สำเร็จ" : "สมัครบัญชีไม่สำเร็จ"}>{authError}</InfoMessage>}

            <form className="form-stack login-form" onSubmit={submitAuth}>
              <label className="field">
                <span>รหัสนิสิต</span>
                <input name="student_code" autoComplete="username" maxLength="30" placeholder="กรอกรหัสนิสิต" required />
              </label>
              {authMode === "register" && (
                <label className="field">
                  <span>ชื่อ-นามสกุล</span>
                  <input name="full_name" autoComplete="name" maxLength="150" placeholder="กรอกชื่อและนามสกุล" required />
                </label>
              )}
              <label className="field">
                <span>รหัสผ่าน</span>
                <input name="password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength="8" maxLength="72" placeholder="อย่างน้อย 8 ตัวอักษร" required />
              </label>
              {authMode === "register" && (
                <label className="field">
                  <span>ยืนยันรหัสผ่าน</span>
                  <input name="password_confirm" type="password" autoComplete="new-password" minLength="8" maxLength="72" placeholder="กรอกรหัสผ่านอีกครั้ง" required />
                </label>
              )}
              <button className="button button-primary button-wide" type="submit" disabled={authLoading}>
                {authLoading ? "กำลังเชื่อมต่อ…" : authMode === "login" ? "เข้าสู่ระบบนิสิต" : "สมัครและเข้าสู่ระบบ"}
                {!authLoading && <span aria-hidden="true">→</span>}
              </button>
            </form>
            <p className="login-footnote">{authMode === "register" ? "ใช้รหัสนิสิตและชื่อ-นามสกุลของคุณ" : "เข้าสู่ระบบด้วยบัญชีที่สมัครไว้เพื่อดูงานและกำหนดส่ง"}</p>
          </section>
        </main>
      ) : (
        <main className="workspace student-workspace" id="student-workspace">
          <aside className="side-nav" aria-label="เมนูนิสิต">
            <div className="nav-caption">เมนูนิสิต</div>
            <div className="student-account-card"><span className="user-avatar">{session?.student?.full_name?.slice(0, 1) || "S"}</span><strong>{session?.student?.full_name}</strong><small>{session?.student?.student_code}</small></div>
            <button className={`nav-item ${page === "assignments" || (page === "detail" && selectedCourseId == null) ? "is-active" : ""}`} type="button" onClick={showAssignments}>
              <span className="nav-icon" aria-hidden="true">▧</span><span>งานของฉัน</span><span className="nav-count">{assignments.length}</span>
            </button>
            <button className={`nav-item ${page === "courses" || page === "course" || (page === "detail" && selectedCourseId != null) ? "is-active" : ""}`} type="button" onClick={showCourses}>
              <span className="nav-icon" aria-hidden="true">▤</span><span>รายวิชา</span><span className="nav-count">{courses.filter(isEnrollmentApproved).length}</span>
            </button>
            <div className="nav-note"><p>รายวิชา งาน และสถานะการส่งงาน</p></div>
          </aside>

          <section className="main-panel">
            {authSuccess && <InfoMessage type="success" title="สำเร็จ">{authSuccess}</InfoMessage>}
            {enrollmentNotice && <InfoMessage type="success" title="ส่งคำขอสำเร็จ">{enrollmentNotice}</InfoMessage>}
            {dataError && <InfoMessage type="error" title="โหลดหรือบันทึกข้อมูลไม่สำเร็จ">{dataError}</InfoMessage>}
            {dataLoading && <div className="loading-state"><span className="spinner" />กำลังโหลดข้อมูลของนิสิต…</div>}

            {page === "courses" ? (
              <>
                <div className="page-heading">
                  <div><p className="eyebrow">รายวิชาของฉัน</p><h1>รายวิชา</h1><p className="page-subtitle">ลงทะเบียนรายวิชาเพื่อดูงานที่อาจารย์เผยแพร่</p></div>
                  <button className="button button-quiet" type="button" disabled={dataLoading} onClick={() => setRefreshVersion((value) => value + 1)}>รีเฟรช</button>
                </div>
                <InfoMessage title="ส่งคำขอลงทะเบียน">เลือกรายวิชาที่เรียนเพื่อส่งคำขอ อาจารย์จะตรวจสอบก่อนอนุมัติ และงานจะแสดงหลังได้รับอนุมัติแล้ว</InfoMessage>
                {!dataLoading && !dataError && courses.length === 0 ? (
                  <div className="empty-state"><span className="empty-icon" aria-hidden="true">▤</span><h3>ยังไม่มีรายวิชาในระบบ</h3><p>ให้อาจารย์เพิ่มรายวิชาก่อน แล้วลองรีเฟรชข้อมูล</p></div>
                ) : (
                  <div className="course-grid student-course-grid">
                    {courses.map((course) => {
                      const enrolled = isEnrollmentApproved(course);
                      const enrollmentStatusAvailable = hasEnrollmentStatus(course);
                      return (
                        <article
                          className={`course-card student-course-card ${enrolled ? "is-openable" : "is-locked"}`}
                          key={course.id}
                          role={enrolled ? "button" : undefined}
                          tabIndex={enrolled ? 0 : undefined}
                          onClick={enrolled ? () => openCourse(course) : undefined}
                          onKeyDown={(event) => {
                            if (!enrolled) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openCourse(course);
                            }
                          }}
                          aria-label={enrolled ? `เปิดรายวิชา ${course.course_code} ${course.course_name}` : undefined}
                        >
                          <div className="card-topline"><span className="course-icon" aria-hidden="true">▤</span><span className="course-code">{course.course_code}</span></div>
                          <h2>{course.course_name}</h2>
                          <p className="card-description">{course.description || "ไม่มีรายละเอียดรายวิชา"}</p>
                          <div className="card-actions">
                            {enrolled ? <span className="status-pill status-reviewed">ลงทะเบียนแล้ว · คลิกเพื่อดูงาน</span>
                              : !enrollmentStatusAvailable ? <span className="status-pill status-late">ตรวจสอบสถานะไม่ได้</span>
                                : course.enrollment_status === "PENDING" ? <span className="status-pill status-draft">รออาจารย์อนุมัติ · ยังเข้าไม่ได้</span>
                                : (
                                  <>
                                    <span className={`status-pill ${course.enrollment_status === "REJECTED" ? "status-late" : "status-none"}`}>
                                      {course.enrollment_status === "REJECTED" ? "คำขอเดิมไม่ผ่าน" : "ยังไม่ได้ลงทะเบียน"}
                                    </span>
                                    <button className="button button-secondary" type="button" disabled={enrollingCourseId === course.id} onClick={() => enrollInCourse(course)}>
                                      {enrollingCourseId === course.id ? "กำลังส่งคำขอ…" : course.enrollment_status === "REJECTED" ? "ส่งคำขอใหม่" : "ส่งคำขอเข้าเรียน"}
                                    </button>
                                  </>
                                )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : page === "course" ? (
              <>
                <button className="back-link" type="button" onClick={showCourses}><span aria-hidden="true">←</span> กลับไปรายวิชา</button>
                {selectedCourse ? (
                  <>
                    <div className="page-heading">
                      <div><p className="eyebrow">งานในรายวิชา</p><h1>{selectedCourse.course_name}</h1><p className="page-subtitle">{selectedCourse.course_code} · {selectedCourse.description || "ไม่มีรายละเอียดรายวิชา"}</p></div>
                      <span className={`status-pill ${isEnrollmentApproved(selectedCourse) ? "status-reviewed" : "status-none"}`}>
                        {isEnrollmentApproved(selectedCourse) ? "อนุมัติแล้ว" : selectedCourse.enrollment_status === "PENDING" ? "รออนุมัติ" : "ยังไม่ได้รับอนุมัติ"}
                      </span>
                    </div>
                    {(!isEnrollmentApproved(selectedCourse) && selectedCourse.enrollment_status === "PENDING") ? (
                      <>
                        <InfoMessage title="รออาจารย์อนุมัติ">ส่งคำขอลงทะเบียนแล้ว งานของรายวิชานี้จะแสดงหลังอาจารย์อนุมัติ</InfoMessage>
                        <div className="empty-state">
                          <span className="empty-icon" aria-hidden="true">◷</span>
                          <h3>คำขอลงทะเบียนกำลังรอพิจารณา</h3>
                          <p>เมื่ออาจารย์อนุมัติ สถานะจะอัปเดตหลังรีเฟรช และงานที่เผยแพร่แล้วจะแสดงที่นี่</p>
                          <button className="button button-quiet" type="button" disabled={dataLoading} onClick={() => setRefreshVersion((value) => value + 1)}>ตรวจสอบสถานะ</button>
                        </div>
                      </>
                    ) : !isEnrollmentApproved(selectedCourse) ? (
                      <>
                        <InfoMessage title={selectedCourse.enrollment_status === "REJECTED" ? "คำขอครั้งก่อนยังไม่ได้รับอนุมัติ" : "ต้องลงทะเบียนก่อนดูงาน"}>
                          {selectedCourse.enrollment_status === "REJECTED" ? "ส่งคำขอลงทะเบียนใหม่ได้ หากยังต้องการเรียนรายวิชานี้" : "ส่งคำขอลงทะเบียนเพื่อให้อาจารย์พิจารณาก่อนดูงาน"}
                        </InfoMessage>
                        <div className="empty-state course-enrollment-state">
                          <span className="empty-icon" aria-hidden="true">▤</span>
                          <h3>ลงทะเบียน {selectedCourse.course_code}</h3>
                          <p>เมื่ออาจารย์อนุมัติคำขอแล้ว จึงจะแสดงงานที่เผยแพร่ในรายวิชานี้</p>
                          <button className="button button-primary" type="button" disabled={enrollingCourseId === selectedCourse.id} onClick={() => enrollInCourse(selectedCourse)}>
                            {enrollingCourseId === selectedCourse.id ? "กำลังส่งคำขอ…" : selectedCourse.enrollment_status === "REJECTED" ? "ส่งคำขอลงทะเบียนอีกครั้ง" : "ส่งคำขอลงทะเบียน"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="student-summary-strip">
                          <div><strong>{dataLoading ? "…" : selectedCourseAssignments.length}</strong><span>งานที่เผยแพร่ในรายวิชานี้</span></div>
                          <div><strong>{dataLoading ? "…" : selectedCourseAssignments.filter((item) => item.submission_status).length}</strong><span>ส่งงานแล้ว</span></div>
                          <div><strong>{dataLoading ? "…" : selectedCourseAssignments.filter((item) => item.submission_status === "REVIEWED").length}</strong><span>ตรวจแล้ว</span></div>
                        </div>
                        <div className="student-list-toolbar">
                          <label className="field"><span>ค้นหางานในรายวิชานี้</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="พิมพ์ชื่องาน" /></label>
                          <span className="student-result-count">{dataLoading ? "กำลังโหลดรายการ…" : `แสดง ${filteredAssignments.length} จาก ${selectedCourseAssignments.length} งาน`}</span>
                        </div>
                        {!dataLoading && !dataError && selectedCourseAssignments.length === 0 ? (
                          <div className="empty-state"><span className="empty-icon" aria-hidden="true">▧</span><h3>รายวิชานี้ยังไม่มีงานที่เผยแพร่</h3><p>งานจะแสดงที่นี่เมื่ออาจารย์เผยแพร่ในรายวิชานี้</p></div>
                        ) : !dataLoading && !dataError && filteredAssignments.length === 0 ? (
                          <div className="empty-state"><span className="empty-icon" aria-hidden="true">⌕</span><h3>ไม่พบงานที่ตรงกับคำค้น</h3><p>ลองเปลี่ยนคำค้นแล้วค้นหาอีกครั้ง</p></div>
                        ) : !dataLoading && !dataError ? (
                          <div className="assignment-list">
                            {filteredAssignments.map((assignment) => (
                              <article className="assignment-card" key={assignment.id}>
                                <div className="assignment-symbol" aria-hidden="true">▧</div>
                                <div className="assignment-content">
                                  <div className="assignment-overline"><span>{assignment.course_code} · {assignment.course_name}</span><span className="status-pill status-published">เผยแพร่แล้ว</span></div>
                                  <h2>{assignment.title}</h2><p className="card-description">{assignment.description || "ไม่มีรายละเอียดเพิ่มเติม"}</p>
                                  <div className="assignment-due"><span aria-hidden="true">◷</span> กำหนดส่ง {formatDate(assignment.due_at)}</div>
                                  <div className="card-actions assignment-actions"><span className={`status-pill status-${String(assignment.submission_status || "none").toLowerCase()}`}>{statusText(assignment.submission_status)}</span><button className="button button-secondary" type="button" onClick={() => openAssignment(assignment)}>ดูรายละเอียดและสถานะ</button></div>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                  </>
                ) : (
                  <div className="empty-state"><span className="empty-icon" aria-hidden="true">▤</span><h3>ไม่พบรายวิชานี้</h3><button className="button button-primary" type="button" onClick={showCourses}>กลับไปรายวิชา</button></div>
                )}
              </>
            ) : page === "detail" ? (
              <>
                <button className="back-link" type="button" onClick={backFromAssignment}><span aria-hidden="true">←</span> {selectedCourseId != null ? "กลับไปรายวิชา" : "กลับไปรายการงาน"}</button>
                {detailLoading ? <div className="loading-state"><span className="spinner" />กำลังโหลดรายละเอียดงาน…</div> : detailError ? (
                  <InfoMessage type="error" title="โหลดรายละเอียดงานไม่สำเร็จ">{detailError}</InfoMessage>
                ) : assignmentDetail ? (
                  <>
                    <div className="page-heading detail-heading">
                      <div><p className="eyebrow">รายละเอียดงาน</p><h1>{assignmentDetail.title}</h1><p className="page-subtitle">{assignmentDetail.course_code} · {assignmentDetail.course_name}</p></div>
                      <span className="status-pill status-published">เผยแพร่แล้ว</span>
                    </div>
                    <article className="student-detail-card">
                      <div className="student-detail-row"><span>กำหนดส่ง</span><strong>{formatDate(assignmentDetail.due_at)}{deadlinePassed ? " · ปิดรับแล้ว" : ""}</strong></div>
                      <div className="student-detail-row"><span>รายละเอียด</span><p>{assignmentDetail.description || "ไม่มีรายละเอียดเพิ่มเติม"}</p></div>
                      <div className="student-detail-row"><span>สถานะการส่งงาน</span><strong className={`status-pill status-${String(assignmentDetail.submission_status || "none").toLowerCase()}`}>{statusText(assignmentDetail.submission_status)}</strong></div>
                      <div className="student-detail-row"><span>เวลาที่ส่ง</span><strong>{assignmentDetail.submitted_at ? formatDate(assignmentDetail.submitted_at) : "—"}</strong></div>
                      <div className="student-detail-row"><span>ไฟล์ที่ส่ง</span><strong>{assignmentDetail.file_original_name || "—"}{assignmentDetail.file_size != null ? ` · ${(Number(assignmentDetail.file_size) / (1024 * 1024)).toFixed(2)} MB` : ""}</strong></div>
                      <div className="student-detail-row"><span>คะแนน</span><strong>{assignmentDetail.score == null ? `ยังไม่มีคะแนน · คะแนนเต็ม ${assignmentDetail.max_score ?? 100}` : `${assignmentDetail.score} / ${assignmentDetail.max_score ?? 100}`}</strong></div>
                      <div className="student-detail-row"><span>ความคิดเห็นจากอาจารย์</span><p>{assignmentDetail.remarks || "—"}</p></div>
                    </article>
                    <section className="student-submit-card" aria-labelledby="student-submit-title">
                      <div className="student-submit-content">
                        <p className="eyebrow">รายละเอียดการส่งงาน</p><h2 id="student-submit-title">ส่งงาน</h2>
                        <p>รองรับทุกนามสกุลไฟล์ ขนาดไม่เกิน 25 MB หากส่งใหม่ ไฟล์เดิมและคะแนนเดิมจะถูกแทนที่</p>
                        {deadlinePassed ? <InfoMessage type="warning" title="ปิดรับงานแล้ว">เลยกำหนดส่ง {formatDate(assignmentDetail.due_at)} ระบบไม่รับไฟล์ใหม่หรือไฟล์แก้ไข</InfoMessage> : null}
                        {uploadSuccess ? <InfoMessage type="success" title="ส่งงานสำเร็จ">{uploadSuccess}</InfoMessage> : null}
                        {uploadError ? <InfoMessage type="error" title="ส่งงานไม่สำเร็จ">{uploadError}</InfoMessage> : null}
                        {!deadlinePassed && <form className="student-upload-form" onSubmit={submitAssignmentFile}>
                          <label className="field"><span>เลือกไฟล์</span><input name="file" type="file" required disabled={uploading || currentTime == null} /></label>
                          <button className="button button-primary" type="submit" disabled={uploading || detailLoading || currentTime == null}>
                            {uploading ? "กำลังอัปโหลด…" : currentTime == null ? "กำลังตรวจสอบกำหนดส่ง…" : assignmentDetail.file_original_name ? "ส่งไฟล์ฉบับใหม่" : "อัปโหลดและส่งงาน"}
                          </button>
                        </form>}
                      </div>
                    </section>
                  </>
                ) : <div className="empty-state"><span className="empty-icon" aria-hidden="true">▧</span><h3>ไม่พบรายละเอียดงาน</h3><button className="button button-primary" type="button" onClick={backFromAssignment}>{selectedCourseId != null ? "กลับไปรายวิชา" : "กลับไปรายการงาน"}</button></div>}
              </>
            ) : (
              <>
                <div className="page-heading">
                  <div><p className="eyebrow">ภาพรวมงานของฉัน</p><h1>งานของฉัน</h1><p className="page-subtitle">งานในรายวิชาที่ลงทะเบียนและสถานะการส่งงานของคุณ</p></div>
                  <div className="heading-actions"><button className="button button-quiet" type="button" disabled={dataLoading} onClick={() => setRefreshVersion((value) => value + 1)}>รีเฟรช</button><button className="button button-secondary" type="button" onClick={() => setPage("courses")}>ดูรายวิชา</button></div>
                </div>
                <div className="student-summary-strip">
                  <div><strong>{dataLoading ? "…" : assignments.length}</strong><span>งานในรายวิชาของฉัน</span></div>
                  <div><strong>{dataLoading ? "…" : assignments.filter((item) => item.submission_status).length}</strong><span>ส่งงานแล้ว</span></div>
                  <div><strong>{dataLoading ? "…" : assignments.filter((item) => item.submission_status === "REVIEWED").length}</strong><span>ตรวจแล้ว</span></div>
                </div>
                <div className="student-list-toolbar">
                  <label className="field"><span>ค้นหางานหรือรายวิชา</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="พิมพ์ชื่อรายวิชา หรืองาน" /></label>
                  <span className="student-result-count">{dataLoading ? "กำลังโหลดรายการ…" : `แสดง ${filteredAssignments.length} จาก ${assignments.length} งาน`}</span>
                </div>
                {dataError ? <InfoMessage type="error" title="โหลดรายการงานไม่สำเร็จ">{dataError} กดรีเฟรชเพื่อลองอีกครั้ง</InfoMessage> : null}
                {!dataLoading && !dataError && assignments.length === 0 ? (
                  <div className="empty-state"><span className="empty-icon" aria-hidden="true">▧</span><h3>ยังไม่มีงานให้แสดง</h3><p>ลงทะเบียนรายวิชา หรือรอให้อาจารย์เผยแพร่งานในรายวิชาที่ลงทะเบียนแล้ว</p><button className="button button-primary" type="button" onClick={() => setPage("courses")}>ไปที่รายวิชา</button></div>
                ) : !dataLoading && !dataError && filteredAssignments.length === 0 ? (
                  <div className="empty-state"><span className="empty-icon" aria-hidden="true">⌕</span><h3>ไม่พบงานที่ตรงกับคำค้น</h3><p>ลองเปลี่ยนคำค้นหรือค้นด้วยรหัสรายวิชา</p></div>
                ) : !dataLoading && !dataError ? (
                  <div className="assignment-list">
                    {filteredAssignments.map((assignment) => (
                      <article className="assignment-card" key={assignment.id}>
                        <div className="assignment-symbol" aria-hidden="true">▧</div>
                        <div className="assignment-content">
                          <div className="assignment-overline"><span>{assignment.course_code} · {assignment.course_name}</span><span className="status-pill status-published">เผยแพร่แล้ว</span></div>
                          <h2>{assignment.title}</h2><p className="card-description">{assignment.description || "ไม่มีรายละเอียดเพิ่มเติม"}</p>
                          <div className="assignment-due"><span aria-hidden="true">◷</span> กำหนดส่ง {formatDate(assignment.due_at)}</div>
                          <div className="card-actions assignment-actions"><span className={`status-pill status-${String(assignment.submission_status || "none").toLowerCase()}`}>{statusText(assignment.submission_status)}</span><button className="button button-secondary" type="button" onClick={() => openAssignment(assignment)}>ดูรายละเอียดและสถานะ</button></div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </main>
      )}

      <footer className="footer"><span>ระบบติดตามสถานะการส่งงานของนิสิต · พื้นที่นิสิต</span></footer>

      {passwordDialog && sessionStatus === "authenticated" && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="student-password-title">
            <div className="modal-heading">
              <div><p className="eyebrow">ความปลอดภัยบัญชี</p><h2 id="student-password-title">เปลี่ยนรหัสผ่านนิสิต</h2></div>
              <button className="modal-close" type="button" aria-label="ปิด" onClick={() => setPasswordDialog(false)}>×</button>
            </div>
            {passwordError && <InfoMessage type="error" title="เปลี่ยนรหัสผ่านไม่สำเร็จ">{passwordError}</InfoMessage>}
            <form className="form-stack" onSubmit={changeStudentPassword}>
              <label className="field"><span>รหัสผ่านปัจจุบัน</span><input name="current_password" type="password" autoComplete="current-password" required /></label>
              <label className="field"><span>รหัสผ่านใหม่</span><input name="new_password" type="password" autoComplete="new-password" minLength="8" maxLength="72" required /><small>อย่างน้อย 8 ตัวอักษร</small></label>
              <label className="field"><span>ยืนยันรหัสผ่านใหม่</span><input name="new_password_confirm" type="password" autoComplete="new-password" minLength="8" maxLength="72" required /></label>
              <div className="modal-actions">
                <button className="button button-quiet" type="button" disabled={passwordSaving} onClick={() => setPasswordDialog(false)}>ยกเลิก</button>
                <button className="button button-primary" type="submit" disabled={passwordSaving}>{passwordSaving ? "กำลังอัปเดต…" : "บันทึกรหัสผ่านใหม่"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default StudentPortal;
