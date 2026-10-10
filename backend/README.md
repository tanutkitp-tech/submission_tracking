# Backend ระบบติดตามสถานะการส่งงาน

## ติดตั้งและตั้งค่า

ต้องมี Node.js 20 ขึ้นไป และ MySQL ตาม schema ใน `../database/init.sql`.

## โครงสร้างโค้ด

- `src/routes/`: กำหนด HTTP method/path และ middleware เท่านั้น
- `src/controllers/`: รับ request, เรียก validator/service แล้วกำหนด HTTP response
- `src/services/`: business logic และ query/transaction ของ Auth, Courses และ Assignments
- `src/validators/`: ตรวจ body, path params และ query params ก่อนเรียก service
- `src/config/`: การตั้งค่า MySQL connection pool
- `src/middleware/`: JWT authentication, 404 และ error handling
- `scripts/`: ตรวจ schema และสร้างบัญชีอาจารย์เริ่มต้นแบบไม่เขียนทับ

1. จากโฟลเดอร์ `backend` รัน `npm install`.
2. คัดลอก `.env.example` เป็น `.env` แล้วกรอกค่าการเชื่อมต่อ MySQL ให้ตรงกับ `database/.env` (ห้ามนำ secret เข้า Git)
3. ตั้ง `JWT_SECRET` เป็นค่าสุ่มอย่างน้อย 32 ตัวอักษร (เช่นสร้างด้วย `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`).
4. หากต้องการเริ่มฐานข้อมูล ให้รันจาก root: `docker compose -f database/docker-compose.yml --env-file database/.env up -d`. phpMyAdmin อยู่ที่ `http://localhost:8080`, MySQL host port คือ `3307`. ห้ามใช้คำสั่งลบ volume.
5. สร้างบัญชีอาจารย์แบบควบคุม: กำหนด `INITIAL_TEACHER_EMAIL`, `INITIAL_TEACHER_NAME`, `INITIAL_TEACHER_PASSWORD` ชั่วคราวใน `backend/.env` แล้วรัน `npm run seed:teacher`. Script จะไม่เขียนทับบัญชีเดิม และต้องใช้รหัสผ่านอย่างน้อย 12 ตัวอักษร; ลบค่ารหัสผ่านชั่วคราวออกหลังสร้างเสร็จ.
6. รัน `npm start` หรือ `npm run dev`. ค่าเริ่มต้นคือ `http://localhost:3000`.

### เพิ่มระบบบัญชีนิสิตในฐานข้อมูลเดิม

หลังอัปเดตโค้ด ให้รัน `npm run migrate:student-auth` จากโฟลเดอร์ `backend` หนึ่งครั้งเพื่อเพิ่ม `students.password_hash` แบบไม่ลบข้อมูลเดิม จากนั้น `npm start` เพื่อเปิด API. ฐานข้อมูลใหม่จะได้คอลัมน์นี้จาก `database/init.sql` โดยตรง. รายการนิสิตเดิมที่ยังไม่มี password hash ต้องสมัครบัญชีด้วยรหัสนิสิตเดิมไม่ได้จนกว่าจะกำหนดรหัสผ่านให้บัญชีนั้น; การสมัครใหม่ใช้รหัสนิสิตที่ยังไม่ซ้ำ.

หากมีบัญชีเก่าที่เก็บรหัสผ่านเป็นข้อความตรง ให้รัน `npm run migrate:password-hashes` หนึ่งครั้งเพื่อแปลงค่าในตาราง `teachers` และ `students` เป็น bcrypt โดยไม่พิมพ์รหัสผ่านออกหน้าจอ.

หากใช้ฐานข้อมูลเดิม ให้รัน `npm run migrate:enrollment-approval` หนึ่งครั้งเพื่อเพิ่มสถานะคำขอลงทะเบียนและเวลาพิจารณา แถว enrollment เดิมจะคงเป็นอนุมัติแล้ว ส่วนคำขอใหม่จะเริ่มที่ `PENDING`.

หากใช้ฐานข้อมูลเดิม ให้รัน `npm run migrate:submission-files` หนึ่งครั้งเพื่อเพิ่ม metadata ไฟล์และคะแนนให้ตาราง `submissions` โดยคงแถวเดิมไว้; ฐานข้อมูลใหม่จะได้คอลัมน์นี้จาก `database/init.sql`. ไฟล์ใหม่จะอยู่ใน `backend/storage/submissions` และต้องสำรองโฟลเดอร์นี้ควบคู่กับฐานข้อมูล.

หากใช้ฐานข้อมูลเดิม ให้รัน `npm run migrate:assignment-max-score` หนึ่งครั้งเพื่อเพิ่มคะแนนเต็มให้ตาราง `assignments`; งานเดิมจะได้คะแนนเต็ม 100 โดยไม่ลบข้อมูล. ฐานข้อมูลใหม่ได้คอลัมน์นี้จาก `database/init.sql`.

## รูปแบบ Response และสิทธิ์

สำเร็จ: `{ "success": true, "message": "...", "data": ... }`; ผิดพลาด: `{ "success": false, "message": "..." }`. JWT ส่งผ่าน `Authorization: Bearer <token>`. Token อายุเริ่มต้น 8 ชั่วโมง. ไม่มี endpoint logout เพราะ JWT แบบ stateless ใช้ต่อได้จนหมดอายุ; ลบ token ฝั่ง client เมื่อต้องการออกจากระบบ.

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/api/health` | สาธารณะ | สถานะ process |
| GET | `/api/health/db` | สาธารณะ | query ฐานข้อมูลจริง; เมื่อ DB ล่มตอบ 500 แบบไม่เปิดเผยรายละเอียด |
| POST | `/api/auth/login` | สาธารณะ | body `{ "email":"teacher@example.com", "password":"..." }`; คืน token และข้อมูลอาจารย์โดยไม่คืน hash |
| GET | `/api/auth/me` | อาจารย์ | ข้อมูลบัญชีจาก token |
| PATCH | `/api/auth/password` | อาจารย์ | body `{ "current_password":"...", "new_password":"..." }`; ตรวจรหัสเดิมและอัปเดต hash ใน `teachers.password_hash` |
| POST | `/api/auth/student/register` | สาธารณะ | body `{ "student_code":"...", "full_name":"...", "password":"..." }`; สร้างบัญชีนิสิตและคืน token; รหัสผ่าน 8–72 bytes |
| POST | `/api/auth/student/login` | สาธารณะ | body `{ "student_code":"...", "password":"..." }`; คืน token และข้อมูลนิสิต |
| GET | `/api/auth/student/me` | นิสิต | ตรวจ token และคืนบัญชีนิสิตปัจจุบัน |
| PATCH | `/api/auth/student/password` | นิสิต | body `{ "current_password":"...", "new_password":"..." }`; ตรวจรหัสเดิมและอัปเดต hash ใน `students.password_hash` |
| GET | `/api/courses` | สาธารณะ | รายวิชาพร้อมชื่ออาจารย์ |
| GET | `/api/courses/mine` | อาจารย์ | รายวิชาที่อาจารย์ปัจจุบันจัดการได้ |
| GET | `/api/courses/enrollments/mine` | อาจารย์ | รายชื่อนิสิตและสถานะ enrollment เฉพาะรายวิชาของอาจารย์ปัจจุบัน |
| PATCH | `/api/courses/:id/enrollments/:studentId` | อาจารย์เจ้าของรายวิชา | body `{ "status":"APPROVED" }` หรือ `{ "status":"REJECTED" }`; พิจารณาได้เฉพาะคำขอ `PENDING` |
| GET | `/api/courses/:id` | สาธารณะ | รายละเอียดรายวิชา |
| POST | `/api/courses` | อาจารย์เจ้าของ | body `course_code`, `course_name`, `description` (optional); owner มาจาก token |
| PUT | `/api/courses/:id` | อาจารย์เจ้าของ | body fields เดียวกับ POST; ไม่เปลี่ยน owner |
| DELETE | `/api/courses/:id` | อาจารย์เจ้าของ | 409 หาก FK ป้องกันการลบ |
| GET | `/api/assignments` | อาจารย์ | เฉพาะ `PUBLISHED`; มีข้อมูลรายวิชา ไม่มีข้อมูลนิสิต |
| GET | `/api/assignments/mine` | อาจารย์ | งานทุกสถานะที่อาจารย์ปัจจุบันจัดการได้ รวม Draft/Closed |
| GET | `/api/assignments/:id` | อาจารย์ | คืน 404 สำหรับ Draft/Closed |
| POST | `/api/assignments` | อาจารย์เจ้าของรายวิชา | body `course_id`, `title`, `description`, `due_at` (ISO datetime), `max_score` (optional, default 100, positive, up to 2 decimals), `status` (`DRAFT`/`PUBLISHED`/`CLOSED`); `created_by` ใช้ token |
| PUT | `/api/assignments/:id` | ผู้สร้าง/เจ้าของ | body เหมือน POST; ตรวจทั้งเจ้าของ assignment และรายวิชา; ถ้าไม่ส่ง `max_score` จะคงค่าเดิม |
| DELETE | `/api/assignments/:id` | ผู้สร้าง | 409 เมื่อ constraint ป้องกันการลบ |
| GET | `/api/assignments/:id/submissions` | อาจารย์เจ้าของงาน | สถานะนิสิตที่ลงทะเบียนในรายวิชานั้น; `status` เป็น null หากยังไม่มี submission |
| GET | `/api/assignments/:id/submissions/:studentId/file` | อาจารย์เจ้าของงาน | ดาวน์โหลดไฟล์ของนิสิตเป็น attachment; ใช้ token อาจารย์ |
| GET | `/api/assignments/:id/submissions/:studentId/preview` | อาจารย์เจ้าของงาน | เปิดดู PDF/JPEG/PNG/GIF/WebP ที่ตรวจ signature แล้ว; รูปแบบอื่นตอบ 415 และยังดาวน์โหลดได้ |
| PATCH | `/api/assignments/:id/submissions/:studentId` | อาจารย์เจ้าของงาน | บันทึก `score` (0 ถึงคะแนนเต็มของงาน, ทศนิยมไม่เกิน 2 ตำแหน่ง) และ `remarks` (ไม่เกิน 500 ตัวอักษร) พร้อมเปลี่ยนเป็น `REVIEWED` |
| GET | `/api/student/courses` | นิสิต | ดูรายวิชาและสถานะการลงทะเบียนของบัญชีตนเอง |
| POST | `/api/student/enrollments` | นิสิต | body `{ "course_id": 1 }`; ส่งคำขอ enrollment สถานะ `PENDING`; ส่งซ้ำขณะรอหรือหลังอนุมัติตอบ 409; คำขอที่ปฏิเสธแล้วส่งใหม่ได้ |
| GET | `/api/student/assignments` | นิสิต | งาน `PUBLISHED` เฉพาะรายวิชาที่อาจารย์อนุมัติแล้ว พร้อมสถานะ submission ของตนเอง |
| GET | `/api/student/assignments/:id` | นิสิต | รายละเอียดและสถานะ submission ของงานในรายวิชาที่ได้รับอนุมัติ; งานอื่นตอบ 404 |
| POST | `/api/student/assignments/:id/submission` | นิสิตที่ได้รับอนุมัติในรายวิชา | `multipart/form-data` field `file`; รับทุกนามสกุล ขนาดไม่เกิน 25 MB; API ปฏิเสธด้วย 409 เมื่อเลย `due_at`; ส่งไฟล์ใหม่ก่อนกำหนดจะแทนไฟล์เดิมและล้างคะแนน/feedback |

รายการ `/api/courses/mine` และ `/api/assignments/mine` รองรับ `page` และ `limit` (ค่าเริ่มต้น 1 และ 20, `limit` สูงสุด 100) และคืน `pagination: { page, limit, total, pages }` เพิ่มจาก `data`.

การดูงานทุก endpoint ต้องเข้าสู่ระบบก่อน: API งานรวมเดิมจำกัดอาจารย์ ส่วน Student endpoints ตรวจ JWT role และแสดงงานเฉพาะ enrollment สถานะ `APPROVED`. งาน Draft และ Closed ไม่ปรากฏในรายการงานของนิสิต. การสมัครสร้างแถว `students`; การขอลงทะเบียนสร้างแถว `enrollments` สถานะ `PENDING`; อาจารย์เจ้าของรายวิชาเท่านั้นที่อนุมัติหรือปฏิเสธได้. รหัสผ่านเปลี่ยนได้หลังยืนยันรหัสเดิม; phpMyAdmin จะแสดง bcrypt hash ไม่ใช่รหัสที่อ่านได้. บัญชีเก่าที่มีรหัสผ่าน plaintext ในคอลัมน์ `password_hash` จะถูกแฮชใหม่เมื่อเข้าสู่ระบบสำเร็จ. ไฟล์ submission เก็บใน `backend/storage/submissions` โดยใช้ชื่อสุ่มที่ไม่เปิดเผยต่อสาธารณะ; ตาราง `submissions` เก็บ metadata และคะแนนเท่านั้น การโหลดไฟล์ต้องผ่าน API ที่ตรวจ token อาจารย์เจ้าของงานและส่งเป็น attachment.

## ทดสอบ

- Automated unit tests: `npm test`.
- Read-only HTTP + MySQL integration checks: start Docker/MySQL and run `npm run test:integration`.
- Read-only schema check: `npm run check:schema`.
- API integration ต้องเปิด MySQL จริงและตั้ง `.env`; ใช้ `npm start` แล้วตรวจ `GET /api/health/db` และคำขอจริงใน Postman.
- Postman: ตั้ง `baseUrl=http://localhost:3000`. เรียก login แล้วใส่ token เป็น Bearer Token สำหรับ `/me` และ CRUD. ตรวจกรณีไม่มี token (401), token ผิด/หมดอายุ (401), เปลี่ยนเจ้าของ (403), ID ไม่มี (404), input ผิด (400), duplicate/FK conflict (409), และ DB หยุดทำงาน (`/api/health/db` ตอบ 500).

`CORS_ORIGINS` รับ origin คั่นด้วย comma; ค่าเริ่มต้น `http://localhost:5173`. ปรับให้ตรงกับ frontend ที่ deploy.
