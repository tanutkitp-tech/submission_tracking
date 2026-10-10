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

## รูปแบบ Response และสิทธิ์

สำเร็จ: `{ "success": true, "message": "...", "data": ... }`; ผิดพลาด: `{ "success": false, "message": "..." }`. JWT ส่งผ่าน `Authorization: Bearer <token>`. Token อายุเริ่มต้น 8 ชั่วโมง. ไม่มี endpoint logout เพราะ JWT แบบ stateless ใช้ต่อได้จนหมดอายุ; ลบ token ฝั่ง client เมื่อต้องการออกจากระบบ.

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/api/health` | สาธารณะ | สถานะ process |
| GET | `/api/health/db` | สาธารณะ | query ฐานข้อมูลจริง; เมื่อ DB ล่มตอบ 500 แบบไม่เปิดเผยรายละเอียด |
| POST | `/api/auth/login` | สาธารณะ | body `{ "email":"teacher@example.com", "password":"..." }`; คืน token และข้อมูลอาจารย์โดยไม่คืน hash |
| GET | `/api/auth/me` | อาจารย์ | ข้อมูลบัญชีจาก token |
| GET | `/api/courses` | สาธารณะ | รายวิชาพร้อมชื่ออาจารย์ |
| GET | `/api/courses/mine` | อาจารย์ | รายวิชาที่อาจารย์ปัจจุบันจัดการได้ |
| GET | `/api/courses/:id` | สาธารณะ | รายละเอียดรายวิชา |
| POST | `/api/courses` | อาจารย์เจ้าของ | body `course_code`, `course_name`, `description` (optional); owner มาจาก token |
| PUT | `/api/courses/:id` | อาจารย์เจ้าของ | body fields เดียวกับ POST; ไม่เปลี่ยน owner |
| DELETE | `/api/courses/:id` | อาจารย์เจ้าของ | 409 หาก FK ป้องกันการลบ |
| GET | `/api/assignments` | สาธารณะ | เฉพาะ `PUBLISHED`; มีข้อมูลรายวิชา ไม่มีข้อมูลนิสิต |
| GET | `/api/assignments/mine` | อาจารย์ | งานทุกสถานะที่อาจารย์ปัจจุบันจัดการได้ รวม Draft/Closed |
| GET | `/api/assignments/:id` | สาธารณะ | คืน 404 สำหรับ Draft/Closed |
| POST | `/api/assignments` | อาจารย์เจ้าของรายวิชา | body `course_id`, `title`, `description`, `due_at` (ISO datetime), `status` (`DRAFT`/`PUBLISHED`/`CLOSED`); `created_by` ใช้ token |
| PUT | `/api/assignments/:id` | ผู้สร้าง/เจ้าของ | body เหมือน POST; ตรวจทั้งเจ้าของ assignment และรายวิชา |
| DELETE | `/api/assignments/:id` | ผู้สร้าง | 409 เมื่อ constraint ป้องกันการลบ |
| GET | `/api/assignments/:id/submissions` | อาจารย์เจ้าของงาน | สถานะนิสิตที่ลงทะเบียนในรายวิชานั้น; `status` เป็น null หากยังไม่มี submission |
| PATCH | `/api/assignments/:id/submissions/:studentId` | อาจารย์เจ้าของงาน | เปลี่ยนสถานะ submission ที่มีอยู่เป็น `REVIEWED`; เรียกซ้ำได้ |

รายการ `/api/courses/mine` และ `/api/assignments/mine` รองรับ `page` และ `limit` (ค่าเริ่มต้น 1 และ 20, `limit` สูงสุด 100) และคืน `pagination: { page, limit, total, pages }` เพิ่มจาก `data`.

งาน Draft และ Closed ไม่ปรากฏใน API สาธารณะ. การดู submission จำกัดอาจารย์ผู้สร้างงานและเจ้าของรายวิชา. API นี้อ่านสถานะที่มีอยู่เท่านั้น; ยังไม่มีการยืนยันตัวตนนิสิตหรือการส่งงาน/อัปโหลดไฟล์ จึงไม่มี endpoint สาธารณะสำหรับสร้าง submission.

## ทดสอบ

- Automated unit tests: `npm test`.
- Read-only HTTP + MySQL integration checks: start Docker/MySQL and run `npm run test:integration`.
- Read-only schema check: `npm run check:schema`.
- API integration ต้องเปิด MySQL จริงและตั้ง `.env`; ใช้ `npm start` แล้วตรวจ `GET /api/health/db` และคำขอจริงใน Postman.
- Postman: ตั้ง `baseUrl=http://localhost:3000`. เรียก login แล้วใส่ token เป็น Bearer Token สำหรับ `/me` และ CRUD. ตรวจกรณีไม่มี token (401), token ผิด/หมดอายุ (401), เปลี่ยนเจ้าของ (403), ID ไม่มี (404), input ผิด (400), duplicate/FK conflict (409), และ DB หยุดทำงาน (`/api/health/db` ตอบ 500).

`CORS_ORIGINS` รับ origin คั่นด้วย comma; ค่าเริ่มต้น `http://localhost:5173`. ปรับให้ตรงกับ frontend ที่ deploy.
