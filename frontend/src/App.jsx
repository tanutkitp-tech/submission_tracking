import { useCallback, useEffect, useState } from "react";
import "./App.css";
import StudentPortal from "./StudentPortal.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
const STORAGE_KEY = "submission-tracking-teacher-session";
const PAGE_SIZE = 20;

class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiRequest(path, options = {}) {
  const { token, onUnauthorized, ...requestOptions } = options;
  const headers = { ...(requestOptions.headers || {}) };
  const isFormData = typeof FormData !== "undefined" && requestOptions.body instanceof FormData;
  if (requestOptions.body != null && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = "Bearer " + token;

  let response;
  try {
    response = await fetch(API_BASE_URL + path, { ...requestOptions, headers });
  } catch {
    throw new ApiError("เชื่อมต่อ Backend ไม่ได้ กรุณาตรวจสอบว่า Backend ทำงานที่ http://localhost:3000");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("Backend ส่งข้อมูลกลับมาในรูปแบบที่อ่านไม่ได้", response.status);
  }

  if (response.status === 401 && token) {
    if (onUnauthorized) onUnauthorized();
    throw new ApiError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง", 401);
  }
  if (!response.ok || payload?.success !== true) {
    throw new ApiError(payload?.message || "คำขอไม่สำเร็จ กรุณาลองใหม่", response.status);
  }
  return payload;
}

function readSavedSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved && typeof saved.token === "string" && saved.token
      ? saved
      : null;
  } catch {
    return null;
  }
}

function friendlyError(error, context = "") {
  if (error?.status === 409 && context === "course-delete") {
    return "ลบรายวิชาไม่ได้ เพราะยังมีงานหรือนิสิตลงทะเบียนที่เกี่ยวข้อง";
  }
  if (error?.status === 409 && context === "assignment-delete") {
    return "ลบงานไม่ได้ เพราะมี submission ที่เกี่ยวข้อง";
  }
  if (error?.status === 409) {
    if (error.message === "Assignment has submissions and cannot be moved to another course") {
      return "ย้ายงานไม่ได้ เพราะมี submission ของนิสิตแล้ว";
    }
    if (error.message === "New maximum score is lower than an existing submission score") {
      return "ลดคะแนนเต็มไม่ได้ เพราะมีคะแนนที่บันทึกไว้สูงกว่าคะแนนเต็มใหม่";
    }
    return "ข้อมูลซ้ำหรือมีรายการที่เกี่ยวข้อง จึงทำรายการนี้ไม่ได้";
  }
  if (error?.status === 400 && error.message?.startsWith("Score cannot exceed")) {
    return "คะแนนที่กรอกเกินคะแนนเต็มของงานนี้";
  }
  if (error?.status === 404 && context === "enrollment-list") {
    return "Backend ที่กำลังทำงานยังไม่มี API คำขอลงทะเบียน กรุณาหยุด Backend เดิมแล้วเริ่ม npm start ใหม่จากโฟลเดอร์ backend";
  }
  if (error?.status === 400) {
    const messages = {
      "Invalid course_code": "กรุณาตรวจสอบรหัสรายวิชา",
      "Invalid course_name": "กรุณากรอกชื่อรายวิชา",
      "Invalid description": "กรุณาตรวจสอบรายละเอียด",
      "Invalid title": "กรุณากรอกชื่องาน",
      "due_at must be a valid ISO date and time": "กรุณาระบุวันและเวลาที่ถูกต้อง",
      "due_at must be in the future": "กำหนดส่งต้องเป็นวันและเวลาในอนาคต",
      "Score is required to mark submission as reviewed": "กรุณากรอกคะแนนก่อนบันทึกผลตรวจ",
      "Invalid assignment status": "กรุณาเลือกสถานะงานที่ถูกต้อง",
      "max_score must be a positive number with up to two decimal places": "คะแนนเต็มต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง",
    };
    return messages[error.message] || error.message || "ข้อมูลที่กรอกไม่ถูกต้อง";
  }
  if (error?.status === 401) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือเซสชันหมดอายุ";
  if (error?.status === 413) return "ไฟล์มีขนาดเกินขีดจำกัด 25 MB";
  if (error?.status === 403) return "บัญชีนี้ไม่มีสิทธิ์ทำรายการดังกล่าว";
  if (error?.status === 404) return "ไม่พบรายการนี้ หรือรายการถูกลบไปแล้ว";
  return error?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

function formatDate(value) {
  if (!value) return "ไม่ระบุกำหนดส่ง";
  const hasTimezone = typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const normalized = typeof value === "string" ? value.replace(" ", "T") : value;
  const parsed = new Date(hasTimezone ? normalized : `${normalized}+07:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

function dateTimeInputValue(value) {
  if (!value) return "";
  const text = String(value);
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) {
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date).reduce((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }
  return text.replace(" ", "T").slice(0, 16);
}

function minimumDueAtValue(now) {
  const nextMinute = new Date(Math.floor(now / 60_000 + 1) * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(nextMinute).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function isFutureBangkokDateTime(value, now) {
  if (!value) return false;
  const normalized = value.length === 16 ? `${value}:00` : value;
  return Date.parse(`${normalized}+07:00`) > now;
}

function statusLabel(status) {
  const labels = {
    DRAFT: "ฉบับร่าง",
    PUBLISHED: "เผยแพร่แล้ว",
    CLOSED: "ปิดรับแล้ว",
    SUBMITTED: "ส่งแล้ว",
    LATE: "ส่งล่าช้า",
    REVIEWED: "ตรวจแล้ว",
    PENDING: "รออนุมัติ",
    APPROVED: "อนุมัติแล้ว",
    REJECTED: "ไม่อนุมัติ",
  };
  return labels[status] || status || "ยังไม่มี submission";
}

function StatusPill({ status }) {
  const statusClass = status === "PENDING"
    ? "status-draft"
    : status === "APPROVED"
      ? "status-reviewed"
      : status === "REJECTED"
        ? "status-late"
        : status
          ? "status-" + String(status).toLowerCase()
          : "status-none";
  const className = "status-pill " + statusClass;
  return <span className={className}>{statusLabel(status)}</span>;
}

function PageNavigation({ pagination, onPageChange }) {
  if (!pagination || pagination.total <= pagination.limit) return null;
  const pages = Math.max(1, pagination.pages);
  return (
    <nav className="page-navigation" aria-label="เปลี่ยนหน้ารายการ">
      <span>
        หน้า {pagination.page} จาก {pages} · {pagination.total} รายการ
      </span>
      <div>
        <button
          className="button button-quiet"
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          ก่อนหน้า
        </button>
        <button
          className="button button-quiet"
          type="button"
          disabled={pagination.page >= pages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          ถัดไป
        </button>
      </div>
    </nav>
  );
}

function Message({ type = "info", title, children, action }) {
  return (
    <div className={"message message-" + type} role={type === "error" ? "alert" : "status"}>
      <div>
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon, title, children, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

function SystemHealth() {
  const [health, setHealth] = useState({
    loading: true,
    api: null,
    database: null,
  });
  const [checkVersion, setCheckVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    const checkHealth = async () => {
      const [apiResult, databaseResult] = await Promise.allSettled([
        apiRequest("/health", { signal: controller.signal }),
        apiRequest("/health/db", { signal: controller.signal }),
      ]);
      if (!active) return;

      const apiReady = apiResult.status === "fulfilled";
      setHealth({
        loading: false,
        api: apiReady,
        database: apiReady
          ? databaseResult.status === "fulfilled" &&
            databaseResult.value.data?.connected === true
          : null,
      });
    };

    void checkHealth();
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [checkVersion]);

  function retryHealthCheck() {
    setHealth((current) => ({ ...current, loading: true }));
    setCheckVersion((value) => value + 1);
  }

  const apiLabel = health.loading
    ? "กำลังตรวจ API"
    : health.api
      ? "API พร้อม"
      : "API ไม่พร้อม";
  const databaseLabel = health.loading
    ? "กำลังตรวจฐานข้อมูล"
    : health.database === null
      ? "ยังตรวจฐานข้อมูลไม่ได้"
      : health.database
        ? "ฐานข้อมูลพร้อม"
        : "ฐานข้อมูลไม่พร้อม";

  return (
    <div className="system-health" aria-live="polite">
      <span className={"health-indicator " + (
        health.loading ? "health-checking" : health.api ? "health-online" : "health-offline"
      )}>
        <i aria-hidden="true" />
        {apiLabel}
      </span>
      <span className={"health-indicator " + (
        health.loading ? "health-checking" : health.database ? "health-online" : "health-offline"
      )}>
        <i aria-hidden="true" />
        {databaseLabel}
      </span>
      <button
        className="health-retry"
        type="button"
        onClick={retryHealthCheck}
        disabled={health.loading}
        aria-label="ตรวจสอบสถานะระบบอีกครั้ง"
        title="ตรวจสอบสถานะระบบอีกครั้ง"
      >
        ↻
      </button>
    </div>
  );
}

function App() {
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [initialSession] = useState(readSavedSession);
  const [token, setToken] = useState(() => initialSession?.token || "");
  const [teacher, setTeacher] = useState(() => initialSession?.teacher || null);
  const [authRole, setAuthRole] = useState(() =>
    window.location.hash.startsWith("#/student") ? "student" : "teacher",
  );
  const [sessionReady, setSessionReady] = useState(() => !initialSession?.token);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [systemError, setSystemError] = useState("");

  const [activeView, setActiveView] = useState("courses");
  const [coursePage, setCoursePage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [coursePagination, setCoursePagination] = useState({
    page: 1, limit: PAGE_SIZE, total: 0, pages: 0,
  });
  const [assignmentPagination, setAssignmentPagination] = useState({
    page: 1, limit: PAGE_SIZE, total: 0, pages: 0,
  });
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [coursesError, setCoursesError] = useState("");
  const [assignmentsError, setAssignmentsError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [notice, setNotice] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [courseDialog, setCourseDialog] = useState(false);
  const [courseEditing, setCourseEditing] = useState(null);
  const [courseForm, setCourseForm] = useState({
    course_code: "", course_name: "", description: "",
  });
  const [courseFormError, setCourseFormError] = useState("");

  const [assignmentDialog, setAssignmentDialog] = useState(false);
  const [assignmentEditing, setAssignmentEditing] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({
    course_id: "", title: "", description: "", due_at: "", max_score: "100", status: "DRAFT",
  });
  const [courseOptions, setCourseOptions] = useState([]);
  const [courseOptionsLoading, setCourseOptionsLoading] = useState(false);
  const [assignmentFormError, setAssignmentFormError] = useState("");

  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState("");
  const [submissionDrafts, setSubmissionDrafts] = useState({});
  const [submissionRefresh, setSubmissionRefresh] = useState(0);
  const [enrollmentRequests, setEnrollmentRequests] = useState([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [enrollmentsError, setEnrollmentsError] = useState("");
  const [enrollmentRefresh, setEnrollmentRefresh] = useState(0);
  const [enrollmentFilter, setEnrollmentFilter] = useState("PENDING");

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTimestamp(Date.now()), 10_000);
    return () => window.clearInterval(interval);
  }, []);

  const clearSession = useCallback((expired = false) => {
    localStorage.removeItem(STORAGE_KEY);
    setToken("");
    setTeacher(null);
    setSessionReady(true);
    setActiveView("courses");
    setSelectedAssignment(null);
    if (expired) {
      setAuthMessage("เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่");
    }
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    apiRequest("/auth/me", {
      token,
      onUnauthorized: () => clearSession(true),
    }).then((payload) => {
      if (!active) return;
      setTeacher(payload.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        token, teacher: payload.data,
      }));
      setSessionReady(true);
    }).catch((error) => {
      if (!active) return;
      if (error.status !== 401) setSystemError(friendlyError(error));
      setSessionReady(true);
    }).finally(() => {
      if (active) setSessionReady(true);
    });
    return () => { active = false; };
  }, [token, clearSession]);

  useEffect(() => {
    if (!token || !sessionReady) return undefined;
    let active = true;

    const loadPage = async (resource, page) => {
      const setLoading = resource === "courses" ? setCoursesLoading : setAssignmentsLoading;
      const setError = resource === "courses" ? setCoursesError : setAssignmentsError;
      setLoading(true);
      setError("");
      try {
        const payload = await apiRequest(
          "/" + resource + "/mine?page=" + page + "&limit=" + PAGE_SIZE,
          { token, onUnauthorized: () => clearSession(true) },
        );
        if (!Array.isArray(payload.data) || !payload.pagination) {
          throw new ApiError("Backend ส่งรายการหรือข้อมูล pagination มาไม่ครบ");
        }
        if (!active) return;
        if (resource === "courses") {
          setCourses(payload.data);
          setCoursePagination(payload.pagination);
        } else {
          setAssignments(payload.data);
          setAssignmentPagination(payload.pagination);
        }
      } catch (error) {
        if (active) setError(friendlyError(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPage("courses", coursePage);
    void loadPage("assignments", assignmentPage);
    return () => { active = false; };
  }, [token, sessionReady, coursePage, assignmentPage, refreshVersion, clearSession]);

  useEffect(() => {
    if (
      !token || !sessionReady || activeView !== "submissions" ||
      !selectedAssignment?.id
    ) return undefined;
    let active = true;
    const loadSubmissions = async () => {
      setSubmissionsLoading(true);
      setSubmissionsError("");
      try {
        const payload = await apiRequest(
          "/assignments/" + selectedAssignment.id + "/submissions",
          { token, onUnauthorized: () => clearSession(true) },
        );
      if (!Array.isArray(payload.data)) {
        throw new ApiError("Backend ส่งรายการ submission มาในรูปแบบที่ไม่ถูกต้อง");
      }
      if (active) {
        setSubmissions(payload.data);
        setSubmissionDrafts(Object.fromEntries(payload.data.map((item) => [String(item.student_id), {
          score: item.score == null ? "" : String(item.score),
          remarks: item.remarks || "",
        }])));
      }
      } catch (error) {
        if (active) setSubmissionsError(friendlyError(error));
      } finally {
        if (active) setSubmissionsLoading(false);
      }
    };
    void loadSubmissions();
    return () => { active = false; };
  }, [token, sessionReady, activeView, selectedAssignment, submissionRefresh, clearSession]);

  useEffect(() => {
    if (!token || !sessionReady) return undefined;
    let active = true;
    const loadEnrollmentRequests = async () => {
      setEnrollmentsLoading(true);
      setEnrollmentsError("");
      try {
        const payload = await apiRequest("/courses/enrollments/mine", {
          token,
          onUnauthorized: () => clearSession(true),
        });
        if (!Array.isArray(payload.data)) throw new ApiError("Backend ส่งคำขอลงทะเบียนมาในรูปแบบที่ไม่ถูกต้อง");
        if (active) setEnrollmentRequests(payload.data);
      } catch (error) {
        if (active) setEnrollmentsError(friendlyError(error, "enrollment-list"));
      } finally {
        if (active) setEnrollmentsLoading(false);
      }
    };
    void loadEnrollmentRequests();
    return () => { active = false; };
  }, [token, sessionReady, activeView, enrollmentRefresh, clearSession]);

  async function submitLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setLoginLoading(true);
    setAuthError("");
    setAuthMessage("");
    try {
      const payload = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      if (!payload.data?.token || !payload.data?.teacher) {
        throw new ApiError("Backend ไม่ได้ส่งข้อมูลเซสชันกลับมา");
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.data));
      setTeacher(payload.data.teacher);
      setSystemError("");
      setSessionReady(false);
      setToken(payload.data.token);
      setActiveView("courses");
      form.reset();
    } catch (error) {
      setAuthError(friendlyError(error));
    } finally {
      setLoginLoading(false);
    }
  }

  function openCourseForm(course = null) {
    setCourseEditing(course);
    setCourseForm(course ? {
      course_code: course.course_code || "",
      course_name: course.course_name || "",
      description: course.description || "",
    } : { course_code: "", course_name: "", description: "" });
    setCourseFormError("");
    setCourseDialog(true);
  }

  async function openAssignmentForm(assignment = null) {
    setAssignmentEditing(assignment);
    setAssignmentForm(assignment ? {
      course_id: String(assignment.course_id || ""),
      title: assignment.title || "",
      description: assignment.description || "",
      due_at: dateTimeInputValue(assignment.due_at),
      max_score: String(assignment.max_score ?? 100),
      status: assignment.status || "DRAFT",
    } : {
      course_id: "", title: "", description: "", due_at: "", max_score: "100", status: "DRAFT",
    });
    setAssignmentFormError("");
    setCourseOptions([]);
    setCourseOptionsLoading(true);
    setAssignmentDialog(true);

    try {
      const first = await apiRequest("/courses/mine?page=1&limit=100", {
        token,
        onUnauthorized: () => clearSession(true),
      });
      if (!Array.isArray(first.data) || !first.pagination) {
        throw new ApiError("Backend ส่งรายการรายวิชาหรือ pagination มาไม่ครบ");
      }
      const pages = Number(first.pagination.pages) || 0;
      const remaining = await Promise.all(
        Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
          apiRequest("/courses/mine?page=" + (index + 2) + "&limit=100", {
            token,
            onUnauthorized: () => clearSession(true),
          }),
        ),
      );
      const allCourses = first.data.concat(...remaining.map((page) => {
        if (!Array.isArray(page.data)) {
          throw new ApiError("Backend ส่งรายการรายวิชามาในรูปแบบที่ไม่ถูกต้อง");
        }
        return page.data;
      }));
      if (assignment?.course_id && !allCourses.some((item) => String(item.id) === String(assignment.course_id))) {
        allCourses.unshift({
          id: assignment.course_id,
          course_code: assignment.course_code,
          course_name: assignment.course_name,
        });
      }
      setCourseOptions(allCourses);
    } catch (error) {
      setAssignmentFormError(friendlyError(error));
      if (assignment?.course_id) {
        setCourseOptions([{
          id: assignment.course_id,
          course_code: assignment.course_code,
          course_name: assignment.course_name,
        }]);
      }
    } finally {
      setCourseOptionsLoading(false);
    }
  }

  async function saveCourse(event) {
    event.preventDefault();
    setBusyAction("course-save");
    setCourseFormError("");
    try {
      const editing = Boolean(courseEditing);
      await apiRequest(editing ? "/courses/" + courseEditing.id : "/courses", {
        method: editing ? "PUT" : "POST",
        token,
        onUnauthorized: () => clearSession(true),
        body: JSON.stringify(courseForm),
      });
      setCourseDialog(false);
      setNotice({
        type: "success",
        text: editing ? "บันทึกการแก้ไขรายวิชาแล้ว" : "เพิ่มรายวิชาแล้ว",
      });
      setCoursePage(1);
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setCourseFormError(friendlyError(error));
    } finally {
      setBusyAction("");
    }
  }

  async function deleteCourse(course) {
    const confirmed = window.confirm(
      "ยืนยันลบรายวิชา " + course.course_code + " · " + course.course_name + " ?",
    );
    if (!confirmed) return;
    setBusyAction("course-" + course.id);
    setNotice(null);
    try {
      await apiRequest("/courses/" + course.id, {
        method: "DELETE",
        token,
        onUnauthorized: () => clearSession(true),
      });
      setNotice({ type: "success", text: "ลบรายวิชาแล้ว" });
      setCoursePage(1);
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setCoursesError(friendlyError(error, "course-delete"));
    } finally {
      setBusyAction("");
    }
  }

  async function saveAssignment(event) {
    event.preventDefault();
    if (!isFutureBangkokDateTime(assignmentForm.due_at, Date.now())) {
      setAssignmentFormError("กำหนดส่งต้องเป็นวันและเวลาในอนาคต");
      return;
    }
    setBusyAction("assignment-save");
    setAssignmentFormError("");
    try {
      const editing = Boolean(assignmentEditing);
      await apiRequest(editing ? "/assignments/" + assignmentEditing.id : "/assignments", {
        method: editing ? "PUT" : "POST",
        token,
        onUnauthorized: () => clearSession(true),
        body: JSON.stringify({
          course_id: Number(assignmentForm.course_id),
          title: assignmentForm.title,
          description: assignmentForm.description,
          due_at: assignmentForm.due_at,
          max_score: Number(assignmentForm.max_score),
          status: assignmentForm.status,
        }),
      });
      setAssignmentDialog(false);
      setNotice({
        type: "success",
        text: editing ? "บันทึกการแก้ไขงานแล้ว" : "เพิ่มงานแล้ว",
      });
      setAssignmentPage(1);
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setAssignmentFormError(friendlyError(error));
    } finally {
      setBusyAction("");
    }
  }

  async function deleteAssignment(assignment) {
    const confirmed = window.confirm("ยืนยันลบงาน “" + assignment.title + "” ?");
    if (!confirmed) return;
    setBusyAction("assignment-" + assignment.id);
    setNotice(null);
    try {
      await apiRequest("/assignments/" + assignment.id, {
        method: "DELETE",
        token,
        onUnauthorized: () => clearSession(true),
      });
      setNotice({ type: "success", text: "ลบงานแล้ว" });
      setAssignmentPage(1);
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setAssignmentsError(friendlyError(error, "assignment-delete"));
    } finally {
      setBusyAction("");
    }
  }

  async function saveGrade(submission, event) {
    event.preventDefault();
    const draft = submissionDrafts[String(submission.student_id)] || {};
    if (draft.score === "" || !Number.isFinite(Number(draft.score)) || Number(draft.score) < 0) {
      setSubmissionsError("กรุณากรอกคะแนนเป็นตัวเลขตั้งแต่ 0 ถึงคะแนนเต็มของงาน");
      return;
    }
    if (Number(draft.score) > Number(selectedAssignment.max_score ?? 100)) {
      setSubmissionsError(`คะแนนต้องไม่เกิน ${selectedAssignment.max_score ?? 100} คะแนน`);
      return;
    }
    setBusyAction("grade-" + submission.student_id);
    setSubmissionsError("");
    setNotice(null);
    try {
      const payload = await apiRequest(
        "/assignments/" + selectedAssignment.id + "/submissions/" + submission.student_id,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ score: Number(draft.score), remarks: draft.remarks || "" }),
          onUnauthorized: () => clearSession(true),
        },
      );
      if (payload.data?.status !== "REVIEWED" || payload.data?.score == null) {
        throw new ApiError("Backend ไม่ได้ยืนยันการบันทึกคะแนนและสถานะตรวจแล้ว");
      }
      setNotice({ type: "success", text: "บันทึกคะแนนและผลตรวจแล้ว" });
      setSubmissionRefresh((value) => value + 1);
    } catch (error) {
      setSubmissionsError(friendlyError(error));
    } finally {
      setBusyAction("");
    }
  }

  async function downloadSubmission(submission) {
    const actionKey = "download-" + submission.student_id;
    setBusyAction(actionKey);
    setSubmissionsError("");
    try {
      const response = await fetch(
        API_BASE_URL + "/assignments/" + selectedAssignment.id + "/submissions/" + submission.student_id + "/file",
        { headers: { Authorization: "Bearer " + token } },
      );
      if (response.status === 401) {
        clearSession(true);
        throw new ApiError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง", 401);
      }
      if (!response.ok) {
        let payload = null;
        try { payload = await response.json(); } catch { /* response has no JSON error body */ }
        throw new ApiError(payload?.message || "ดาวน์โหลดไฟล์ไม่สำเร็จ", response.status);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = submission.file_original_name || "submission";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      setSubmissionsError(friendlyError(error));
    } finally {
      setBusyAction("");
    }
  }

  async function previewSubmission(submission) {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      setSubmissionsError("เบราว์เซอร์บล็อกหน้าต่างตัวอย่างไฟล์ กรุณาอนุญาต popup แล้วลองใหม่");
      return;
    }
    previewWindow.opener = null;
    const actionKey = "preview-" + submission.student_id;
    setBusyAction(actionKey);
    setSubmissionsError("");
    try {
      const response = await fetch(
        API_BASE_URL + "/assignments/" + selectedAssignment.id + "/submissions/" + submission.student_id + "/preview",
        { headers: { Authorization: "Bearer " + token } },
      );
      if (response.status === 401) {
        clearSession(true);
        throw new ApiError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง", 401);
      }
      if (!response.ok) {
        let payload = null;
        try { payload = await response.json(); } catch { /* binary endpoint may not return JSON */ }
        if (response.status === 415) throw new ApiError("เปิดตัวอย่างไม่ได้สำหรับไฟล์ชนิดนี้ ให้ดาวน์โหลดไฟล์เพื่อตรวจแทน", 415);
        throw new ApiError(payload?.message || "เปิดตัวอย่างไฟล์ไม่สำเร็จ", response.status);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      previewWindow.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      previewWindow.close();
      setSubmissionsError(friendlyError(error));
    } finally {
      setBusyAction("");
    }
  }

  function updateSubmissionDraft(studentId, field, value) {
    const key = String(studentId);
    setSubmissionDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] || { score: "", remarks: "" }), [field]: value },
    }));
  }

  async function reviewEnrollment(request, status) {
    const actionKey = "enrollment-" + request.course_id + "-" + request.student_id;
    setBusyAction(actionKey);
    setNotice(null);
    setEnrollmentsError("");
    try {
      const payload = await apiRequest(
        "/courses/" + request.course_id + "/enrollments/" + request.student_id,
        {
          method: "PATCH",
          token,
          onUnauthorized: () => clearSession(true),
          body: JSON.stringify({ status }),
        },
      );
      if (payload.data?.enrollment_status !== status) {
        throw new ApiError("Backend ไม่ได้ยืนยันผลการพิจารณาคำขอลงทะเบียน");
      }
      setNotice({
        type: "success",
        text: status === "APPROVED" ? "อนุมัติคำขอลงทะเบียนแล้ว" : "ปฏิเสธคำขอลงทะเบียนแล้ว",
      });
      setEnrollmentRefresh((value) => value + 1);
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      setEnrollmentsError(friendlyError(error));
    } finally {
      setBusyAction("");
    }
  }

  function openSubmissions(assignment) {
    setSelectedAssignment(assignment);
    setSubmissions([]);
    setSubmissionsError("");
    setNotice(null);
    setActiveView("submissions");
  }

  function signOut() {
    clearSession(false);
    setAuthMessage("");
    setNotice(null);
  }

  async function savePassword(event) {
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
      await apiRequest("/auth/password", {
        method: "PATCH",
        token,
        onUnauthorized: () => clearSession(true),
        body: JSON.stringify({ current_password: values.current_password, new_password: values.new_password }),
      });
      setPasswordDialog(false);
      setNotice({ type: "success", text: "เปลี่ยนรหัสผ่านและอัปเดตในฐานข้อมูลแล้ว" });
      form.reset();
    } catch (error) {
      setPasswordError(error.message === "Current password is incorrect"
        ? "รหัสผ่านปัจจุบันไม่ถูกต้อง"
        : error.status === 400
          ? "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร และไม่ซ้ำกับรหัสเดิม"
          : friendlyError(error));
    } finally {
      setPasswordSaving(false);
    }
  }

  function switchAuthRole(role) {
    setAuthRole(role);
    window.history.replaceState(
      null,
      "",
      role === "student" ? "#/student" : "#/login",
    );
  }

  const pendingEnrollmentCount = enrollmentRequests.filter((item) => item.enrollment_status === "PENDING").length;
  const visibleEnrollmentRequests = enrollmentFilter === "ALL"
    ? enrollmentRequests
    : enrollmentRequests.filter((item) => item.enrollment_status === "PENDING");

  if (authRole === "student") {
    return <StudentPortal onTeacherPortal={() => switchAuthRole("teacher")} />;
  }

  if (!token) {
    return (
      <div className="app-shell auth-shell">
        <header className="topbar auth-topbar">
          <a className="brand" href="#login" aria-label="ระบบติดตามการส่งงาน">
            <span className="brand-icon">ST</span>
            <span className="brand-name">SUBMISSION TRACKING</span>
          </a>
          <div className="portal-actions">
            <span className="topbar-tag">พื้นที่สำหรับอาจารย์</span>
            <button
              className="button button-secondary portal-switch-button"
              type="button"
              onClick={() => switchAuthRole("student")}
            >
              หน้าสำหรับนิสิต
            </button>
          </div>
        </header>
        <main className="auth-main" id="login">
          <section className="auth-intro">
            <span className="intro-mark" aria-hidden="true">✓</span>
            <p className="eyebrow">TEACHER WORKSPACE</p>
            <h1>จัดการรายวิชา<br />และติดตามงาน</h1>
            <p>เข้าสู่ระบบเพื่อดูแลรายวิชา จัดการงาน และตรวจสถานะ submission ที่ Backend บันทึกไว้</p>
            <div className="auth-points">
              <span><i>01</i> รายวิชาและงานของคุณ</span>
              <span><i>02</i> สถานะจากข้อมูลจริง</span>
              <span><i>03</i> ทำเครื่องหมายตรวจแล้ว</span>
            </div>
          </section>
          <section className="login-card" aria-labelledby="login-title">
            <div className="login-card-heading">
              <span className="login-icon" aria-hidden="true">↗</span>
              <p className="eyebrow">ยินดีต้อนรับ</p>
              <h2 id="login-title">เข้าสู่ระบบอาจารย์</h2>
              <p>ใช้บัญชีอาจารย์ที่ตั้งค่าไว้ใน Backend</p>
            </div>
            <SystemHealth />
            {authMessage && <Message type="warning">{authMessage}</Message>}
            {systemError && <Message type="error" title="เชื่อมต่อระบบไม่ได้">{systemError}</Message>}
            {authError && <Message type="error" title="เข้าสู่ระบบไม่สำเร็จ">{authError}</Message>}
            <form className="form-stack login-form" onSubmit={submitLogin}>
              <label className="field">
                <span>อีเมล</span>
                <input name="email" type="email" autoComplete="username" placeholder="teacher@example.com" required />
              </label>
              <label className="field">
                <span>รหัสผ่าน</span>
                <input name="password" type="password" autoComplete="current-password" placeholder="กรอกรหัสผ่าน" required />
              </label>
              <button className="button button-primary button-wide" type="submit" disabled={loginLoading}>
                {loginLoading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
                {!loginLoading && <span aria-hidden="true">→</span>}
              </button>
            </form>
            <p className="login-footnote">ระบบจะเก็บเฉพาะ token สำหรับใช้งาน API บนเบราว์เซอร์นี้</p>
            <p className="login-footnote">ไม่มีสมัครบัญชีจากหน้านี้ ต้องใช้บัญชีอาจารย์ที่สร้างไว้ใน Backend แล้ว</p>
          </section>
        </main>
        <footer className="footer"><span>ระบบติดตามสถานะการส่งงานของนิสิต · สำหรับอาจารย์</span></footer>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="boot-screen">
        <span className="brand-icon">ST</span>
        <p>กำลังตรวจสอบเซสชันอาจารย์…</p>
      </div>
    );
  }

  const reviewedCount = submissions.filter((item) => item.status === "REVIEWED").length;
  const hasSubmissionCount = submissions.filter((item) => item.status != null).length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#workspace" aria-label="กลับหน้ารายวิชา">
          <span className="brand-icon">ST</span>
          <span className="brand-name">SUBMISSION TRACKING</span>
        </a>
        <SystemHealth />
        <div className="topbar-user">
          <div className="user-avatar" aria-hidden="true">
            {(teacher?.full_name || teacher?.email || "อ").trim().charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <strong>{teacher?.full_name || "อาจารย์"}</strong>
            <span>{teacher?.email || "บัญชีอาจารย์"}</span>
          </div>
          <button className="button button-secondary signout-button" type="button" onClick={() => { setPasswordError(""); setPasswordDialog(true); }}>เปลี่ยนรหัสผ่าน</button>
          <button className="button button-quiet signout-button" type="button" onClick={signOut}>ออกจากระบบ</button>
        </div>
      </header>

      <main className="workspace" id="workspace">
        <aside className="side-nav" aria-label="เมนูหลัก">
          <div className="nav-caption">เมนูจัดการ</div>
          <button
            className={"nav-item " + (activeView === "courses" ? "is-active" : "")}
            type="button"
            onClick={() => { setActiveView("courses"); setNotice(null); }}
          >
            <span className="nav-icon" aria-hidden="true">▤</span>
            <span>รายวิชาของฉัน</span>
            <span className="nav-count">{coursePagination.total}</span>
          </button>
          <button
            id="enrollment-requests-tab"
            className={"nav-item nav-item-enrollments " + (activeView === "enrollments" ? "is-active" : "")}
            type="button"
            aria-current={activeView === "enrollments" ? "page" : undefined}
            onClick={() => { setActiveView("enrollments"); setEnrollmentFilter("PENDING"); setNotice(null); }}
          >
            <span className="nav-icon" aria-hidden="true">◷</span>
            <span>คำขอลงทะเบียน</span>
            <span className={"nav-count " + (pendingEnrollmentCount > 0 ? "nav-count-pending" : "")}>{pendingEnrollmentCount}</span>
          </button>
          <button
            className={"nav-item " + (activeView === "assignments" || activeView === "submissions" ? "is-active" : "")}
            type="button"
            onClick={() => { setActiveView("assignments"); setNotice(null); }}
          >
            <span className="nav-icon" aria-hidden="true">▧</span>
            <span>งานของฉัน</span>
            <span className="nav-count">{assignmentPagination.total}</span>
          </button>
          <div className="nav-note">
            <span className="nav-note-dot" />
            <p>ข้อมูลรายการและสถานะโหลดจาก Backend</p>
          </div>
        </aside>

        <section className="main-panel">
          {systemError && <Message type="warning" title="ตรวจสอบเซสชันไม่สำเร็จ">{systemError}</Message>}
          {notice && (
            <Message
              type={notice.type}
              title={notice.type === "success" ? "ดำเนินการสำเร็จ" : "แจ้งเตือน"}
              action={<button className="message-close" type="button" aria-label="ปิดข้อความ" onClick={() => setNotice(null)}>×</button>}
            >
              {notice.text}
            </Message>
          )}

          {activeView === "courses" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">COURSE MANAGEMENT</p>
                  <h1>รายวิชาของฉัน</h1>
                  <p className="page-subtitle">จัดการรายวิชาที่บัญชีอาจารย์นี้เป็นเจ้าของ</p>
                </div>
                <div className="heading-actions">
                  <button className="button button-quiet" type="button" disabled={coursesLoading} onClick={() => setRefreshVersion((value) => value + 1)}>
                    {coursesLoading ? "กำลังโหลด…" : "รีเฟรช"}
                  </button>
                  <button className="button button-primary" type="button" onClick={() => openCourseForm()}>
                    <span aria-hidden="true">＋</span> เพิ่มรายวิชา
                  </button>
                </div>
              </div>
              {coursesError && (
                <Message type="error" title="โหลดหรือจัดการรายวิชาไม่สำเร็จ" action={
                  <button className="button button-quiet" type="button" onClick={() => setRefreshVersion((value) => value + 1)}>ลองอีกครั้ง</button>
                }>{coursesError}</Message>
              )}
              {coursesLoading ? (
                <div className="loading-state"><span className="spinner" />กำลังโหลดรายวิชา…</div>
              ) : courses.length === 0 && !coursesError ? (
                <EmptyState icon="▤" title="ยังไม่มีรายวิชาของคุณ" action={
                  <button className="button button-primary" type="button" onClick={() => openCourseForm()}>เพิ่มรายวิชาแรก</button>
                }>
                  รายการจะแสดงเมื่อ Backend ตอบกลับข้อมูลรายวิชาของบัญชีนี้
                </EmptyState>
              ) : (
                <div className="course-grid">
                  {courses.map((course) => (
                    <article className="course-card" key={course.id}>
                      <div className="card-topline">
                        <span className="course-icon" aria-hidden="true">▤</span>
                        <span className="course-code">{course.course_code}</span>
                      </div>
                      <h2>{course.course_name}</h2>
                      <p className="card-description">{course.description || "ไม่มีรายละเอียดรายวิชา"}</p>
                      <div className="card-meta">รหัสรายวิชา <strong>{course.course_code}</strong></div>
                      <div className="card-actions">
                        <button className="button button-secondary" type="button" onClick={() => openCourseForm(course)}>แก้ไข</button>
                        <button className="button button-danger-quiet" type="button" disabled={busyAction === "course-" + course.id} onClick={() => deleteCourse(course)}>
                          {busyAction === "course-" + course.id ? "กำลังลบ…" : "ลบ"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <PageNavigation pagination={coursePagination} onPageChange={setCoursePage} />
            </>
          )}

          {activeView === "enrollments" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">COURSE ENROLLMENT</p>
                  <h1>คำขอลงทะเบียน</h1>
                  <p className="page-subtitle">ตรวจสอบรายชื่อนิสิตและอนุมัติก่อนให้นิสิตเห็นงานในรายวิชา</p>
                </div>
                <button className="button button-quiet" type="button" disabled={enrollmentsLoading} onClick={() => setEnrollmentRefresh((value) => value + 1)}>
                  {enrollmentsLoading ? "กำลังโหลด…" : "รีเฟรช"}
                </button>
              </div>
              <div className="summary-strip">
                <div><strong>{enrollmentsLoading ? "…" : pendingEnrollmentCount}</strong><span>รอพิจารณา</span></div>
                <div><strong>{enrollmentsLoading ? "…" : enrollmentRequests.filter((item) => item.enrollment_status === "APPROVED").length}</strong><span>อนุมัติแล้ว</span></div>
                <div><strong>{enrollmentsLoading ? "…" : enrollmentRequests.filter((item) => item.enrollment_status === "REJECTED").length}</strong><span>ไม่อนุมัติ</span></div>
              </div>
              <div className="section-caption enrollment-toolbar">
                <div><h2>รายชื่อนิสิต</h2><p>แสดงเฉพาะคำขอของรายวิชาที่บัญชีอาจารย์นี้เป็นเจ้าของ</p></div>
                <div className="heading-actions" role="group" aria-label="กรองคำขอลงทะเบียน">
                  <button className={"button " + (enrollmentFilter === "PENDING" ? "button-primary" : "button-quiet")} type="button" onClick={() => setEnrollmentFilter("PENDING")}>รอพิจารณา</button>
                  <button className={"button " + (enrollmentFilter === "ALL" ? "button-primary" : "button-quiet")} type="button" onClick={() => setEnrollmentFilter("ALL")}>ทั้งหมด</button>
                </div>
              </div>
              {enrollmentsError && <Message type="error" title="โหลดหรือพิจารณาคำขอไม่สำเร็จ" action={
                <button className="button button-quiet" type="button" onClick={() => setEnrollmentRefresh((value) => value + 1)}>ลองอีกครั้ง</button>
              }>{enrollmentsError}</Message>}
              {enrollmentsLoading ? (
                <div className="loading-state"><span className="spinner" />กำลังโหลดคำขอลงทะเบียน…</div>
              ) : visibleEnrollmentRequests.length === 0 && !enrollmentsError ? (
                <EmptyState icon="◷" title={enrollmentFilter === "PENDING" ? "ไม่มีคำขอรอพิจารณา" : "ยังไม่มีคำขอลงทะเบียน"}>
                  {enrollmentFilter === "PENDING" ? "คำขอใหม่จากนิสิตจะแสดงที่นี่ พร้อมชื่อและรหัสนิสิต" : "เมื่อมีนิสิตส่งคำขอลงทะเบียน รายชื่อจะแสดงที่นี่"}
                </EmptyState>
              ) : (
                <div className="submission-table-wrap">
                  <table className="submission-table enrollment-table">
                    <thead>
                      <tr><th>รายวิชา</th><th>นิสิต</th><th>รหัสนิสิต</th><th>วันที่ขอ</th><th>สถานะ</th><th>การพิจารณา</th></tr>
                    </thead>
                    <tbody>
                      {visibleEnrollmentRequests.map((request) => {
                        const actionKey = "enrollment-" + request.course_id + "-" + request.student_id;
                        return (
                          <tr key={request.course_id + "-" + request.student_id}>
                            <td><strong>{request.course_code}</strong><span className="student-code">{request.course_name}</span></td>
                            <td>{request.full_name || "ไม่ระบุชื่อ"}</td>
                            <td><span className="student-code">{request.student_code || "—"}</span></td>
                            <td>{formatDate(request.requested_at)}</td>
                            <td><StatusPill status={request.enrollment_status} /></td>
                            <td>
                              {request.enrollment_status === "PENDING" ? (
                                <div className="enrollment-actions">
                                  <button className="button button-primary button-small" type="button" disabled={busyAction === actionKey} onClick={() => reviewEnrollment(request, "APPROVED")}>
                                    {busyAction === actionKey ? "กำลังบันทึก…" : "อนุมัติ"}
                                  </button>
                                  <button className="button button-danger-quiet button-small" type="button" disabled={busyAction === actionKey} onClick={() => reviewEnrollment(request, "REJECTED")}>ไม่อนุมัติ</button>
                                </div>
                              ) : request.enrollment_status === "APPROVED" ? "อนุมัติแล้ว" : "ไม่อนุมัติแล้ว"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activeView === "assignments" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">ASSIGNMENT MANAGEMENT</p>
                  <h1>งานของฉัน</h1>
                  <p className="page-subtitle">จัดการงานทุกสถานะ และเปิดดูสถานะ submission ที่มีอยู่</p>
                </div>
                <div className="heading-actions">
                  <button className="button button-quiet" type="button" disabled={assignmentsLoading} onClick={() => setRefreshVersion((value) => value + 1)}>
                    {assignmentsLoading ? "กำลังโหลด…" : "รีเฟรช"}
                  </button>
                  <button className="button button-primary" type="button" onClick={() => openAssignmentForm()}>
                    <span aria-hidden="true">＋</span> เพิ่มงาน
                  </button>
                </div>
              </div>
              {assignmentsError && (
                <Message type="error" title="โหลดหรือจัดการงานไม่สำเร็จ" action={
                  <button className="button button-quiet" type="button" onClick={() => setRefreshVersion((value) => value + 1)}>ลองอีกครั้ง</button>
                }>{assignmentsError}</Message>
              )}
              {assignmentsLoading ? (
                <div className="loading-state"><span className="spinner" />กำลังโหลดงาน…</div>
              ) : assignments.length === 0 && !assignmentsError ? (
                <EmptyState icon="▧" title="ยังไม่มีงานของคุณ" action={
                  <button className="button button-primary" type="button" onClick={() => openAssignmentForm()}>เพิ่มงานแรก</button>
                }>
                  รายการจะแสดงเมื่อ Backend ตอบกลับข้อมูลงานที่คุณจัดการ
                </EmptyState>
              ) : (
                <div className="assignment-list">
                  {assignments.map((assignment) => (
                    <article className="assignment-card" key={assignment.id}>
                      <div className="assignment-symbol" aria-hidden="true">▧</div>
                      <div className="assignment-content">
                        <div className="assignment-overline">
                          <span>{assignment.course_code} · {assignment.course_name}</span>
                          <StatusPill status={assignment.status} />
                        </div>
                        <h2>{assignment.title}</h2>
                        <p className="card-description">{assignment.description || "ไม่มีรายละเอียดเพิ่มเติม"}</p>
                        <div className="assignment-due"><span aria-hidden="true">◷</span> คะแนนเต็ม {assignment.max_score ?? 100} · กำหนดส่ง {formatDate(assignment.due_at)}</div>
                        <div className="card-actions assignment-actions">
                          <button className="button button-secondary" type="button" onClick={() => openSubmissions(assignment)}>ดูสถานะ submission</button>
                          <button className="button button-quiet" type="button" onClick={() => openAssignmentForm(assignment)}>แก้ไข</button>
                          <button className="button button-danger-quiet" type="button" disabled={busyAction === "assignment-" + assignment.id} onClick={() => deleteAssignment(assignment)}>
                            {busyAction === "assignment-" + assignment.id ? "กำลังลบ…" : "ลบ"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <PageNavigation pagination={assignmentPagination} onPageChange={setAssignmentPage} />
            </>
          )}

          {activeView === "submissions" && selectedAssignment && (
            <>
              <button className="back-link" type="button" onClick={() => { setActiveView("assignments"); setNotice(null); }}>
                <span aria-hidden="true">←</span> กลับไปงานของฉัน
              </button>
              <div className="page-heading detail-heading">
                <div>
                  <p className="eyebrow">SUBMISSION STATUS</p>
                  <h1>{selectedAssignment.title}</h1>
                  <p className="page-subtitle">{selectedAssignment.course_code} · {selectedAssignment.course_name} · คะแนนเต็ม {selectedAssignment.max_score ?? 100} · กำหนดส่ง {formatDate(selectedAssignment.due_at)}</p>
                </div>
                <StatusPill status={selectedAssignment.status} />
              </div>
              <div className="summary-strip">
                <div><strong>{submissionsLoading ? "…" : submissions.length}</strong><span>รายชื่อนิสิตในผลลัพธ์</span></div>
                <div><strong>{submissionsLoading ? "…" : hasSubmissionCount}</strong><span>มี submission</span></div>
                <div><strong>{submissionsLoading ? "…" : reviewedCount}</strong><span>ตรวจแล้ว</span></div>
              </div>
              <div className="section-caption">
                <div><h2>สถานะจาก Backend</h2><p>แสดงเฉพาะรายชื่อและสถานะที่ API ส่งกลับมา</p></div>
                <button className="button button-quiet" type="button" onClick={() => setSubmissionRefresh((value) => value + 1)}>รีเฟรช</button>
              </div>
              {submissionsError && (
                <Message type="error" title="โหลดหรือปรับสถานะ submission ไม่สำเร็จ" action={
                  <button className="button button-quiet" type="button" onClick={() => setSubmissionRefresh((value) => value + 1)}>ลองอีกครั้ง</button>
                }>{submissionsError}</Message>
              )}
              {submissionsLoading ? (
                <div className="loading-state"><span className="spinner" />กำลังโหลดสถานะ submission…</div>
              ) : submissions.length === 0 && !submissionsError ? (
                <EmptyState icon="◌" title="ไม่มีรายชื่อในผลลัพธ์">
                  Backend ยังไม่มีรายชื่อนิสิตที่ลงทะเบียนในรายวิชานี้
                </EmptyState>
              ) : (
                <div className="submission-table-wrap">
                  <table className="submission-table">
                    <thead>
                      <tr><th>นิสิต</th><th>สถานะ</th><th>ไฟล์ที่ส่ง</th><th>เวลาที่ส่ง</th><th>คะแนน</th><th>ความคิดเห็น / การตรวจ</th></tr>
                    </thead>
                    <tbody>
                      {submissions.map((item) => (
                        <tr key={item.student_id}>
                          <td>
                            <strong>{item.full_name || "ไม่ระบุชื่อ"}</strong>
                            <span className="student-code">{item.student_code || "—"}</span>
                          </td>
                          <td><StatusPill status={item.status} /></td>
                          <td className="submission-file-cell">
                            {item.file_original_name ? <>
                              <strong title={item.file_original_name}>{item.file_original_name}</strong>
                              <span>{item.file_size == null ? "" : `${(Number(item.file_size) / (1024 * 1024)).toFixed(2)} MB`}</span>
                              <button className="button button-secondary button-small" type="button" disabled={busyAction === "download-" + item.student_id} onClick={() => downloadSubmission(item)}>
                                {busyAction === "download-" + item.student_id ? "กำลังเตรียมไฟล์…" : "ดาวน์โหลดเพื่อตรวจ"}
                              </button>
                              {["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"].includes(item.file_mime_type) && <button className="button button-quiet button-small" type="button" disabled={busyAction === "preview-" + item.student_id} onClick={() => previewSubmission(item)}>
                                {busyAction === "preview-" + item.student_id ? "กำลังเปิดตัวอย่าง…" : "ดูตัวอย่าง"}
                              </button>}
                            </> : <span className="muted-text">ยังไม่มีไฟล์แนบ</span>}
                          </td>
                          <td>{item.submitted_at ? formatDate(item.submitted_at) : "—"}</td>
                          <td>{item.status ? (
                            <label className="grade-field"><span>คะแนน / {selectedAssignment.max_score ?? 100}</span><input className="grade-input" aria-label={`คะแนนของ ${item.full_name || item.student_code}`} type="number" min="0" max={selectedAssignment.max_score ?? 100} step="0.01" value={submissionDrafts[String(item.student_id)]?.score ?? ""} onChange={(event) => updateSubmissionDraft(item.student_id, "score", event.target.value)} disabled={busyAction === "grade-" + item.student_id} /></label>
                          ) : "—"}</td>
                          <td>
                            {item.status ? <form className="submission-grade-form" onSubmit={(event) => saveGrade(item, event)}>
                              <textarea aria-label={`ความคิดเห็นของ ${item.full_name || item.student_code}`} maxLength="500" rows="2" placeholder="เขียน feedback ให้นิสิต (ไม่เกิน 500 ตัวอักษร)" value={submissionDrafts[String(item.student_id)]?.remarks ?? ""} onChange={(event) => updateSubmissionDraft(item.student_id, "remarks", event.target.value)} disabled={busyAction === "grade-" + item.student_id} />
                              <button className="button button-primary button-small" type="submit" disabled={busyAction === "grade-" + item.student_id}>
                                {busyAction === "grade-" + item.student_id ? "กำลังบันทึก…" : item.status === "REVIEWED" ? "อัปเดตคะแนน / feedback" : "บันทึกคะแนนและตรวจแล้ว"}
                              </button>
                            </form> : <span className="muted-text">ยังไม่มีรายการให้ตรวจ</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="data-note">ข้อมูลไฟล์ คะแนน และ feedback มาจาก Backend โดยตรง; เปิดตัวอย่างได้เฉพาะ PDF และรูปภาพที่รองรับ ส่วนไฟล์อื่นดาวน์โหลดได้ เฉพาะอาจารย์เจ้าของงานเท่านั้น</p>
            </>
          )}
        </section>
      </main>

      <footer className="footer"><span>ระบบติดตามสถานะการส่งงานของนิสิต · ข้อมูลตาม API ของ Backend</span></footer>

      {courseDialog && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="course-dialog-title">
            <div className="modal-heading">
              <div><p className="eyebrow">COURSE DETAILS</p><h2 id="course-dialog-title">{courseEditing ? "แก้ไขรายวิชา" : "เพิ่มรายวิชา"}</h2></div>
              <button className="modal-close" type="button" aria-label="ปิด" onClick={() => setCourseDialog(false)}>×</button>
            </div>
            {courseFormError && <Message type="error">{courseFormError}</Message>}
            <form className="form-stack" onSubmit={saveCourse}>
              <label className="field">
                <span>รหัสรายวิชา</span>
                <input autoFocus name="course_code" maxLength="30" required value={courseForm.course_code} onChange={(event) => setCourseForm((form) => ({ ...form, course_code: event.target.value }))} placeholder="เช่น CS101" />
              </label>
              <label className="field">
                <span>ชื่อรายวิชา</span>
                <input name="course_name" maxLength="200" required value={courseForm.course_name} onChange={(event) => setCourseForm((form) => ({ ...form, course_name: event.target.value }))} placeholder="ชื่อรายวิชา" />
              </label>
              <label className="field">
                <span>รายละเอียด <small>ไม่บังคับ</small></span>
                <textarea name="description" rows="4" value={courseForm.description} onChange={(event) => setCourseForm((form) => ({ ...form, description: event.target.value }))} placeholder="รายละเอียดรายวิชา" />
              </label>
              <div className="modal-actions">
                <button className="button button-quiet" type="button" onClick={() => setCourseDialog(false)}>ยกเลิก</button>
                <button className="button button-primary" type="submit" disabled={busyAction === "course-save"}>{busyAction === "course-save" ? "กำลังบันทึก…" : "บันทึกรายวิชา"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {assignmentDialog && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="assignment-dialog-title">
            <div className="modal-heading">
              <div><p className="eyebrow">ASSIGNMENT DETAILS</p><h2 id="assignment-dialog-title">{assignmentEditing ? "แก้ไขงาน" : "เพิ่มงาน"}</h2></div>
              <button className="modal-close" type="button" aria-label="ปิด" onClick={() => setAssignmentDialog(false)}>×</button>
            </div>
            {assignmentFormError && <Message type="error">{assignmentFormError}</Message>}
            <form className="form-stack" onSubmit={saveAssignment}>
              <label className="field">
                <span>รายวิชา</span>
                <select required disabled={courseOptionsLoading || courseOptions.length === 0} value={assignmentForm.course_id} onChange={(event) => setAssignmentForm((form) => ({ ...form, course_id: event.target.value }))}>
                  <option value="">{courseOptionsLoading ? "กำลังโหลดรายวิชา…" : "เลือกรายวิชา"}</option>
                  {courseOptions.map((course) => <option key={course.id} value={course.id}>{course.course_code} · {course.course_name}</option>)}
                </select>
                {!courseOptionsLoading && courseOptions.length === 0 && <small>เพิ่มรายวิชาของคุณก่อน จึงจะสร้างงานได้</small>}
              </label>
              <label className="field">
                <span>ชื่องาน</span>
                <input autoFocus name="title" maxLength="200" required value={assignmentForm.title} onChange={(event) => setAssignmentForm((form) => ({ ...form, title: event.target.value }))} placeholder="ชื่องาน" />
              </label>
              <label className="field">
                <span>รายละเอียด <small>ไม่บังคับ</small></span>
                <textarea name="description" rows="3" value={assignmentForm.description} onChange={(event) => setAssignmentForm((form) => ({ ...form, description: event.target.value }))} placeholder="คำอธิบายงาน" />
              </label>
              <label className="field">
                <span>คะแนนเต็ม</span>
                <input type="number" min="0.01" max="999999.99" step="0.01" required value={assignmentForm.max_score} onChange={(event) => setAssignmentForm((form) => ({ ...form, max_score: event.target.value }))} />
                <small>ค่าเริ่มต้น 100 คะแนน</small>
              </label>
              <div className="form-row">
                <label className="field">
                  <span>กำหนดส่ง</span>
                  <input
                    type="datetime-local"
                    required
                    min={minimumDueAtValue(currentTimestamp)}
                    value={assignmentForm.due_at}
                    onInvalid={(event) => {
                      event.currentTarget.setCustomValidity("กำหนดส่งต้องเป็นวันและเวลาในอนาคต");
                      setAssignmentFormError("กำหนดส่งต้องเป็นวันและเวลาในอนาคต");
                    }}
                    onChange={(event) => {
                      event.currentTarget.setCustomValidity("");
                      const dueAt = event.target.value;
                      setAssignmentForm((form) => ({ ...form, due_at: dueAt }));
                      setAssignmentFormError(isFutureBangkokDateTime(dueAt, Date.now())
                        ? ""
                        : "กำหนดส่งต้องเป็นวันและเวลาในอนาคต");
                    }}
                  />
                  <small>เลือกวันและเวลาตั้งแต่นาทีถัดไปเป็นต้นไป</small>
                </label>
                <label className="field">
                  <span>สถานะ</span>
                  <select value={assignmentForm.status} onChange={(event) => setAssignmentForm((form) => ({ ...form, status: event.target.value }))}>
                    <option value="DRAFT">ฉบับร่าง</option>
                    <option value="PUBLISHED">เผยแพร่แล้ว</option>
                    <option value="CLOSED">ปิดรับแล้ว</option>
                  </select>
                </label>
              </div>
              <div className="modal-actions">
                <button className="button button-quiet" type="button" onClick={() => setAssignmentDialog(false)}>ยกเลิก</button>
                <button className="button button-primary" type="submit" disabled={busyAction === "assignment-save" || courseOptionsLoading || courseOptions.length === 0}>
                  {busyAction === "assignment-save" ? "กำลังบันทึก…" : "บันทึกงาน"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {passwordDialog && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="teacher-password-title">
            <div className="modal-heading">
              <div><p className="eyebrow">ACCOUNT SECURITY</p><h2 id="teacher-password-title">เปลี่ยนรหัสผ่านอาจารย์</h2></div>
              <button className="modal-close" type="button" aria-label="ปิด" onClick={() => setPasswordDialog(false)}>×</button>
            </div>
            {passwordError && <Message type="error" title="เปลี่ยนรหัสผ่านไม่สำเร็จ">{passwordError}</Message>}
            <form className="form-stack" onSubmit={savePassword}>
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

export default App;
