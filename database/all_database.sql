-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: mysql:3306
-- Generation Time: Oct 10, 2026 at 11:08 PM
-- Server version: 8.0.46
-- PHP Version: 8.3.35

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `assignment_tracking`
--

-- --------------------------------------------------------

--
-- Table structure for table `assignments`
--

CREATE TABLE `assignments` (
  `id` int UNSIGNED NOT NULL,
  `course_id` int UNSIGNED NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text,
  `due_at` datetime NOT NULL,
  `max_score` decimal(8,2) NOT NULL DEFAULT '100.00',
  `status` enum('DRAFT','PUBLISHED','CLOSED') NOT NULL DEFAULT 'DRAFT',
  `created_by` int UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `assignments`
--

INSERT INTO `assignments` (`id`, `course_id`, `title`, `description`, `due_at`, `max_score`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 'hw1', 'ทำงานส่งในชั้นเรียน', '2026-10-12 23:59:00', 100.00, 'PUBLISHED', 2, '2026-10-10 20:19:35', '2026-10-10 21:16:47'),
(2, 2, 'asssignment-1', 'ทำงานในห้อง', '2026-10-11 04:30:00', 100.00, 'PUBLISHED', 2, '2026-10-10 21:22:14', '2026-10-10 21:22:23'),
(3, 4, 'xxx', 'xxx', '2026-10-11 05:58:00', 100.00, 'PUBLISHED', 2, '2026-10-10 22:57:14', '2026-10-10 22:58:00');

-- --------------------------------------------------------

--
-- Table structure for table `courses`
--

CREATE TABLE `courses` (
  `id` int UNSIGNED NOT NULL,
  `course_code` varchar(30) NOT NULL,
  `course_name` varchar(200) NOT NULL,
  `description` text,
  `teacher_id` int UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `courses`
--

INSERT INTO `courses` (`id`, `course_code`, `course_name`, `description`, `teacher_id`, `created_at`, `updated_at`) VALUES
(1, 'CS101', 'itm', '820', 2, '2026-10-10 20:18:36', '2026-10-10 21:19:10'),
(2, '1212312121', 'AI', '820', 2, '2026-10-10 21:18:49', '2026-10-10 21:21:19'),
(3, 'OS01', 'OS', '820', 2, '2026-10-10 21:38:40', '2026-10-10 21:38:40'),
(4, '11111111', 'ดนตรี', '821', 2, '2026-10-10 21:56:17', '2026-10-10 21:56:17');

-- --------------------------------------------------------

--
-- Table structure for table `enrollments`
--

CREATE TABLE `enrollments` (
  `id` int UNSIGNED NOT NULL,
  `course_id` int UNSIGNED NOT NULL,
  `student_id` int UNSIGNED NOT NULL,
  `enrollment_status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `enrolled_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `enrollments`
--

INSERT INTO `enrollments` (`id`, `course_id`, `student_id`, `enrollment_status`, `enrolled_at`, `reviewed_at`) VALUES
(1, 1, 1, 'APPROVED', '2026-10-10 20:58:24', NULL),
(2, 1, 2, 'APPROVED', '2026-10-10 21:04:35', NULL),
(3, 2, 1, 'APPROVED', '2026-10-10 21:22:39', NULL),
(4, 3, 1, 'PENDING', '2026-10-10 22:25:56', NULL),
(5, 4, 1, 'APPROVED', '2026-10-10 21:56:26', '2026-10-10 22:25:15');

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `id` int UNSIGNED NOT NULL,
  `student_code` varchar(30) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `students`
--

INSERT INTO `students` (`id`, `student_code`, `full_name`, `password_hash`, `created_at`) VALUES
(1, '6721652226', 'ธนัชกฤษฏิ์ พงษ์ไพบูลย์', '$2b$12$GUiw8aAcQlz7IfFXMQzKJuGQq8yZD/4TWmamsYWvvHrOF21NgBK56', '2026-10-10 20:57:51'),
(2, '6721652227', 'สมชาย ใจดี', '$2b$12$ebSyinpmSgXxSFUgy1/VW.oSuzSgH/AvFJcBqqrgWiO/z6z8EN5gu', '2026-10-10 21:04:23');

-- --------------------------------------------------------

--
-- Table structure for table `submissions`
--

CREATE TABLE `submissions` (
  `id` int UNSIGNED NOT NULL,
  `assignment_id` int UNSIGNED NOT NULL,
  `student_id` int UNSIGNED NOT NULL,
  `status` enum('SUBMITTED','LATE','REVIEWED') NOT NULL DEFAULT 'SUBMITTED',
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `remarks` varchar(500) DEFAULT NULL,
  `file_storage_key` char(36) DEFAULT NULL,
  `file_original_name` varchar(255) DEFAULT NULL,
  `file_mime_type` varchar(150) DEFAULT NULL,
  `file_size` bigint UNSIGNED DEFAULT NULL,
  `score` decimal(8,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `submissions`
--

INSERT INTO `submissions` (`id`, `assignment_id`, `student_id`, `status`, `submitted_at`, `remarks`, `file_storage_key`, `file_original_name`, `file_mime_type`, `file_size`, `score`, `created_at`, `updated_at`) VALUES
(1, 2, 1, 'REVIEWED', '2026-10-11 05:42:57', NULL, 'af4c6881-d1d6-4475-9074-04e9c77c8031', 'antacilgel.jpg', 'image/jpeg', 136539, 100.00, '2026-10-10 22:42:57', '2026-10-10 22:53:33'),
(2, 1, 1, 'REVIEWED', '2026-10-11 05:43:15', 'ดีมาก', '2acfc2ef-895d-4b27-b7fa-a041455cd5c2', 'poisien_inhaler.jpg', 'image/jpeg', 9924, 10.00, '2026-10-10 22:43:15', '2026-10-10 22:44:36');

-- --------------------------------------------------------

--
-- Table structure for table `teachers`
--

CREATE TABLE `teachers` (
  `id` int UNSIGNED NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `teachers`
--

INSERT INTO `teachers` (`id`, `full_name`, `email`, `password_hash`, `created_at`, `updated_at`) VALUES
(1, 'อาจารย์ผู้ดูแลระบบ', 'teacher@gmail.com', '$2b$12$jwkhg37jORa/3icvdnyJZ.zHChz34t9kLwBjPl.AMp1mLFUmERITK', '2026-10-10 19:03:16', '2026-10-10 21:10:52'),
(2, 'อาจารย์ผู้ใช้งานระบบ', 'teacher.5d620714@submission-tracking.test', '$2b$12$CrNj6pHlCkS4OC7SKN5Xie8G9LxR5M9kLCphcLCvcu6VnntDKK2GK', '2026-10-10 19:07:28', '2026-10-10 21:17:28');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `assignments`
--
ALTER TABLE `assignments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_assignments_course_due` (`course_id`,`due_at`),
  ADD KEY `idx_assignments_status` (`status`),
  ADD KEY `fk_assignments_teacher` (`created_by`);

--
-- Indexes for table `courses`
--
ALTER TABLE `courses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `course_code` (`course_code`),
  ADD KEY `fk_courses_teacher` (`teacher_id`);

--
-- Indexes for table `enrollments`
--
ALTER TABLE `enrollments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_course_student` (`course_id`,`student_id`),
  ADD KEY `fk_enrollments_student` (`student_id`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `student_code` (`student_code`);

--
-- Indexes for table `submissions`
--
ALTER TABLE `submissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_assignment_student` (`assignment_id`,`student_id`),
  ADD KEY `idx_submissions_student` (`student_id`),
  ADD KEY `idx_submissions_status` (`status`);

--
-- Indexes for table `teachers`
--
ALTER TABLE `teachers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `assignments`
--
ALTER TABLE `assignments`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `courses`
--
ALTER TABLE `courses`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `enrollments`
--
ALTER TABLE `enrollments`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `students`
--
ALTER TABLE `students`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `submissions`
--
ALTER TABLE `submissions`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `teachers`
--
ALTER TABLE `teachers`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `assignments`
--
ALTER TABLE `assignments`
  ADD CONSTRAINT `fk_assignments_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_assignments_teacher` FOREIGN KEY (`created_by`) REFERENCES `teachers` (`id`) ON DELETE RESTRICT;

--
-- Constraints for table `courses`
--
ALTER TABLE `courses`
  ADD CONSTRAINT `fk_courses_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE RESTRICT;

--
-- Constraints for table `enrollments`
--
ALTER TABLE `enrollments`
  ADD CONSTRAINT `fk_enrollments_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_enrollments_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `submissions`
--
ALTER TABLE `submissions`
  ADD CONSTRAINT `fk_submissions_assignment` FOREIGN KEY (`assignment_id`) REFERENCES `assignments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_submissions_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
