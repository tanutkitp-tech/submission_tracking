
CREATE DATABASE IF NOT EXISTS assignment_tracking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE assignment_tracking;

CREATE TABLE IF NOT EXISTS teachers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_code VARCHAR(30) NOT NULL UNIQUE,
  course_name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  teacher_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_courses_teacher
    FOREIGN KEY (teacher_id)
    REFERENCES teachers(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS students (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_code VARCHAR(30) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  enrollment_status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,

  CONSTRAINT uq_course_student
    UNIQUE (course_id, student_id),

  CONSTRAINT fk_enrollments_course
    FOREIGN KEY (course_id)
    REFERENCES courses(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_enrollments_student
    FOREIGN KEY (student_id)
    REFERENCES students(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id INT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  due_at DATETIME NOT NULL,
  max_score DECIMAL(8,2) NOT NULL DEFAULT 100.00,
  status ENUM('DRAFT', 'PUBLISHED', 'CLOSED')
    NOT NULL DEFAULT 'DRAFT',
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_assignments_course_due (course_id, due_at),
  INDEX idx_assignments_status (status),

  CONSTRAINT fk_assignments_course
    FOREIGN KEY (course_id)
    REFERENCES courses(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_assignments_teacher
    FOREIGN KEY (created_by)
    REFERENCES teachers(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS submissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  status ENUM('SUBMITTED', 'LATE', 'REVIEWED')
    NOT NULL DEFAULT 'SUBMITTED',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remarks VARCHAR(500) NULL,
  file_storage_key CHAR(36) NULL,
  file_original_name VARCHAR(255) NULL,
  file_mime_type VARCHAR(150) NULL,
  file_size BIGINT UNSIGNED NULL,
  score DECIMAL(8,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_assignment_student
    UNIQUE (assignment_id, student_id),

  INDEX idx_submissions_student (student_id),
  INDEX idx_submissions_status (status),

  CONSTRAINT fk_submissions_assignment
    FOREIGN KEY (assignment_id)
    REFERENCES assignments(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_submissions_student
    FOREIGN KEY (student_id)
    REFERENCES students(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_rate_limit_buckets (
  bucket_key BINARY(32) NOT NULL,
  attempt_count INT UNSIGNED NOT NULL,
  reset_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (bucket_key),
  KEY idx_auth_rate_limit_reset_at (reset_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teacher_signup_invites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code_hash BINARY(32) NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  used_at BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_teacher_signup_invite_code_hash (code_hash),
  KEY idx_teacher_signup_invite_expires_at (expires_at)
) ENGINE=InnoDB;
