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
- `scripts/`: ตรวจ schema, เตรียมตารางเสริม และสร้างบัญชีหรือรหัสเชิญอาจารย์

1. จากโฟลเดอร์ `backend` รัน `npm install`.
2. คัดลอก `.env.example` เป็น `.env` แล้วกรอกค่าการเชื่อมต่อ MySQL ให้ตรงกับ `database/.env` (ห้ามนำ secret เข้า Git)
3. ตั้ง `JWT_SECRET` เป็นค่าสุ่มอย่างน้อย 32 ตัวอักษร (เช่นสร้างด้วย `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`).
4. หากต้องการเริ่มฐานข้อมูล ให้รันจาก root: `docker compose -f database/docker-compose.yml --env-file database/.env up -d`. phpMyAdmin อยู่ที่ `http://localhost:8080`, MySQL host port คือ `3307`. ห้ามใช้คำสั่งลบ volume.
5. สร้างบัญชีอาจารย์แบบควบคุม: กำหนด `INITIAL_TEACHER_EMAIL`, `INITIAL_TEACHER_NAME`, `INITIAL_TEACHER_PASSWORD` ชั่วคราวใน `backend/.env` แล้วรัน `npm run seed:teacher`. Script จะไม่เขียนทับบัญชีเดิม และต้องใช้รหัสผ่านอย่างน้อย 12 ตัวอักษร; ลบค่ารหัสผ่านชั่วคราวออกหลังสร้างเสร็จ.
6. ฐานข้อมูลใหม่จะสร้างตารางเสริมจาก `database/init.sql` อยู่แล้ว. สำหรับฐานข้อมูลเดิม ให้รัน `npm run migrate:production-security`; คำสั่งนี้สร้างเฉพาะตารางที่ยังไม่มีและไม่แก้ข้อมูลเดิม.
7. เมื่อนำขึ้นใช้งานจริง ให้กำหนด `NODE_ENV=production` ใน environment ของบริการ แล้วรัน `npm start`. หากไม่กำหนด ระบบจะใช้โหมดพัฒนาและสมัครอาจารย์โดยไม่ใช้รหัสเชิญได้; `npm run dev` ใช้สำหรับพัฒนาในเครื่อง. ค่าเริ่มต้นคือ `http://localhost:3000`.

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
| POST | `/api/auth/register` | สาธารณะ | body `{ "full_name":"Teacher Example", "email":"teacher@example.test", "password":"...", "invite_code":"..." }`; สมัครอาจารย์และคืน token; อีเมลต้องมีส่วนลงท้ายและรหัสผ่าน 8–72 bytes; production ต้องใช้รหัสเชิญที่ยังไม่หมดอายุและยังไม่เคยใช้ |
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
| POST | `/api/assignments` | อาจารย์เจ้าของรายวิชา | body รับเฉพาะ `course_id`, `title`, `description`, `due_at`, `max_score`, `status`; `description` optional; `due_at` ต้องเป็น ISO datetime ในอนาคต รับ `Z` หรือ UTC offset แล้วแปลงเป็นเวลา Asia/Bangkok; datetime-local ที่ไม่มี offset ถือเป็นเวลา Asia/Bangkok; `max_score` optional (default 100, positive, up to 2 decimals); `status` optional (default `DRAFT`, รับ `DRAFT`/`PUBLISHED`/`CLOSED`); `created_by` ใช้ token |
| PUT | `/api/assignments/:id` | ผู้สร้าง/เจ้าของ | body รับเฉพาะ fields เดียวกับ POST; งานเดิมแก้ไขได้แม้ `due_at` ผ่านไปแล้ว; ตรวจทั้งเจ้าของ assignment และรายวิชา; ถ้าไม่ส่ง `max_score` หรือ `status` จะคงค่าเดิม; ย้ายไปรายวิชาอื่นไม่ได้เมื่อมี submission และตอบ 409; งานที่ยังไม่มี submission ย้ายได้เฉพาะรายวิชาที่อาจารย์เป็นเจ้าของ |
| DELETE | `/api/assignments/:id` | ผู้สร้าง | 409 เมื่อ constraint ป้องกันการลบ |
| GET | `/api/assignments/:id/submissions` | อาจารย์เจ้าของงาน | สถานะนิสิตที่ลงทะเบียนในรายวิชานั้น; `status` เป็น null หากยังไม่มี submission |
| GET | `/api/assignments/:id/submissions/:studentId/file` | อาจารย์เจ้าของงาน | ดาวน์โหลดไฟล์ของนิสิตเป็น attachment; ใช้ token อาจารย์ |
| GET | `/api/assignments/:id/submissions/:studentId/preview` | อาจารย์เจ้าของงาน | เปิดดู PDF/JPEG/PNG/GIF/WebP ที่ตรวจ signature แล้ว; รูปแบบอื่นตอบ 415 และยังดาวน์โหลดได้ |
| PATCH | `/api/assignments/:id/submissions/:studentId` | อาจารย์เจ้าของงาน | ต้องส่ง `score` (0 ถึงคะแนนเต็มของงาน, ทศนิยมไม่เกิน 2 ตำแหน่ง); `remarks` เลือกส่งได้ (ไม่เกิน 500 ตัวอักษร); คะแนนว่าง/ไม่มีคะแนนตอบ 400 และไม่เปลี่ยนสถานะเป็น `REVIEWED` |
| GET | `/api/student/courses` | นิสิต | ดูรายวิชาและสถานะการลงทะเบียนของบัญชีตนเอง |
| POST | `/api/student/enrollments` | นิสิต | body `{ "course_id": 1 }`; ส่งคำขอ enrollment สถานะ `PENDING`; ส่งซ้ำขณะรอหรือหลังอนุมัติตอบ 409; คำขอที่ปฏิเสธแล้วส่งใหม่ได้ |
| GET | `/api/student/assignments` | นิสิต | งาน `PUBLISHED` เฉพาะรายวิชาที่อาจารย์อนุมัติแล้ว พร้อมสถานะ submission ของตนเอง |
| GET | `/api/student/assignments/:id` | นิสิต | รายละเอียดและสถานะ submission ของงานในรายวิชาที่ได้รับอนุมัติ; งานอื่นตอบ 404 |
| POST | `/api/student/assignments/:id/submission` | นิสิตที่ได้รับอนุมัติในรายวิชา | `multipart/form-data` field `file`; รับทุกนามสกุล ขนาดไม่เกิน 25 MB; API ปฏิเสธด้วย 409 เมื่อเลย `due_at`; ส่งไฟล์ใหม่ก่อนกำหนดจะแทนไฟล์เดิมและล้างคะแนน/feedback |

คำขอเข้าสู่ระบบจำกัด 10 ครั้งต่อ IP และอีเมลหรือรหัสนิสิตใน 15 นาที และคำขอสมัครจำกัด 5 ครั้งต่อ IP และอีเมลหรือรหัสนิสิตใน 1 ชั่วโมง เพื่อไม่ให้ผู้ใช้ในเครือข่ายเดียวกันจำกัดกันเอง. ตัวนับเก็บในตาราง MySQL ที่ใช้ร่วมกันได้ทุก instance โดยเก็บ HMAC แทน IP และตัวระบุบัญชี. ทุก instance ต้องใช้ `JWT_SECRET` เดียวกันเพื่อให้ตัวนับร่วมกันได้. หลัง reverse proxy ให้ตั้ง `TRUST_PROXY_HOPS` เป็นจำนวน proxy ที่เชื่อถือได้; ค่าเริ่มต้น 0 จะไม่ใช้ IP จาก header ที่ส่งต่อมา. หากฐานข้อมูลตารางนี้ใช้งานไม่ได้ ระบบจะปฏิเสธคำขอแทนการปิดตัวจำกัด.

ก่อนเปิดให้สมัครอาจารย์ใน production ให้ผู้ดูแลรัน `npm run invite:teacher` จากโฟลเดอร์ `backend` หลังเตรียมตารางเสริมแล้ว คำสั่งจะแสดงรหัสใช้ครั้งเดียวซึ่งหมดอายุใน 24 ชั่วโมง ส่งรหัสให้ผู้สมัครโดยตรงผ่านช่องทางที่ปลอดภัย; ระบบเก็บเฉพาะ hash และจะใช้รหัสได้กับบัญชีเดียว. รหัสนี้ยังไม่ใช่การยืนยันเจ้าของอีเมล ผู้ดูแลจึงควรส่งให้ผู้สมัครที่ตรวจสอบแล้ว. หากไม่มีผู้ดูแลติดต่อให้ขอรหัสจากผู้ดูแลระบบของโปรเจกต์. โหมดพัฒนายังสมัครได้โดยไม่กรอกรหัสเพื่อให้ทดสอบในเครื่องต่อได้.

ไฟล์ `database/all_database.sql` ยังถูกติดตามใน Git ของโปรเจกต์นี้และอาจมีข้อมูลที่ระบุตัวบุคคลได้. ห้ามเผยแพร่ repository หรือส่งต่อไฟล์นี้จนกว่าจะตรวจและแทนข้อมูลจริงด้วยข้อมูลตัวอย่างแล้ว; การลบไฟล์ออกจาก working tree อย่างเดียวไม่ลบสำเนาในประวัติ Git.

ไฟล์งานที่อัปโหลดเก็บไว้ใน `backend/storage/submissions`. ก่อน deploy ให้ตั้ง persistent storage และสำรองข้อมูลโฟลเดอร์นี้ควบคู่กับฐานข้อมูล; หากรัน Backend หลาย instance ต้องใช้พื้นที่เก็บไฟล์ร่วมกัน.

รายการ `/api/courses/mine` และ `/api/assignments/mine` รองรับ `page` และ `limit` (ค่าเริ่มต้น 1 และ 20, `limit` สูงสุด 100) และคืน `pagination: { page, limit, total, pages }` เพิ่มจาก `data`.

การดูงานทุก endpoint ต้องเข้าสู่ระบบก่อน: API งานรวมเดิมจำกัดอาจารย์ ส่วน Student endpoints ตรวจ JWT role และแสดงงานเฉพาะ enrollment สถานะ `APPROVED`. งาน Draft และ Closed ไม่ปรากฏในรายการงานของนิสิต. การสมัครสร้างแถว `students`; การขอลงทะเบียนสร้างแถว `enrollments` สถานะ `PENDING`; อาจารย์เจ้าของรายวิชาเท่านั้นที่อนุมัติหรือปฏิเสธได้. รหัสผ่านเปลี่ยนได้หลังยืนยันรหัสเดิม; phpMyAdmin จะแสดง bcrypt hash ไม่ใช่รหัสที่อ่านได้. บัญชีเก่าที่มีรหัสผ่าน plaintext ในคอลัมน์ `password_hash` จะถูกแฮชใหม่เมื่อเข้าสู่ระบบสำเร็จ. ไฟล์ submission เก็บใน `backend/storage/submissions` โดยใช้ชื่อสุ่มที่ไม่เปิดเผยต่อสาธารณะ; ตาราง `submissions` เก็บ metadata และคะแนนเท่านั้น การโหลดไฟล์ต้องผ่าน API ที่ตรวจ token อาจารย์เจ้าของงานและส่งเป็น attachment.

Datetime ที่ส่งเข้ามาพร้อม timezone จะถูกแปลงเป็นเวลา Asia/Bangkok ก่อนเก็บ เพราะคอลัมน์ `assignments.due_at` เป็น MySQL `DATETIME` ซึ่งเก็บค่าเวลาโดยไม่เก็บ timezone; ค่า `due_at` ใน response จึงเป็นเวลา Bangkok แบบไม่มี suffix timezone. ทุก body ที่เขียนข้อมูลจะปฏิเสธ field ที่ไม่อยู่ในสัญญา API ด้วย 400; query ของ pagination รับเฉพาะ `page` และ `limit` และต้องเป็นจำนวนเต็ม.

ทุก connection ของ Backend ตั้ง MySQL session timezone เป็น `+07:00` ก่อน query เพื่อให้ `CURRENT_TIMESTAMP`, เวลา `TIMESTAMP` และกำหนดส่งใน `DATETIME` ใช้เวลาไทยตรงกัน โดยไม่ขึ้นกับ timezone ของเครื่องที่รัน MySQL.

## ทดสอบ

- Automated unit tests: `npm test`.
- HTTP + MySQL integration checks: start Docker/MySQL and run `npm run test:integration`. การทดสอบจะเพิ่มตัวนับในตารางความปลอดภัยซึ่งระบบล้างรายการหมดอายุเป็นระยะ.
- Read-only schema check: `npm run check:schema`.
- API integration ต้องเปิด MySQL จริงและตั้ง `.env`; ใช้ `npm start` แล้วตรวจ `GET /api/health/db` และคำขอจริงใน Postman.
- Postman: ตั้ง `baseUrl=http://localhost:3000`. เรียก login แล้วใส่ token เป็น Bearer Token สำหรับ `/me` และ CRUD. ตรวจกรณีไม่มี token (401), token ผิด/หมดอายุ (401), เปลี่ยนเจ้าของ (403), ID ไม่มี (404), input ผิด (400), duplicate/FK conflict (409), และ DB หยุดทำงาน (`/api/health/db` ตอบ 500).

`CORS_ORIGINS` รับ origin คั่นด้วย comma. ในโหมดพัฒนา Backend ยอมรับหน้า Vite จาก `localhost` หรือ `127.0.0.1` ที่พอร์ต 5173/5174 เพื่อรองรับกรณีพอร์ตหลักถูกใช้งาน; เมื่อ `NODE_ENV=production` จะยอมรับเฉพาะ origin ที่ระบุใน `CORS_ORIGINS`.
