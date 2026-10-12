# Frontend ระบบติดตามสถานะการส่งงาน

## ตั้งค่าและเปิดใช้งาน

ติดตั้ง dependencies แล้วเปิดหน้าเว็บสำหรับพัฒนา:

```powershell
npm install
npm run dev
```

เว็บใช้พอร์ต `5173` และเรียก API ที่ `http://localhost:3000/api` เป็นค่าเริ่มต้น หาก Backend ใช้ URL อื่น ให้กำหนด `VITE_API_BASE_URL` ก่อนเปิดหรือสร้าง production build

## ตรวจสอบและสร้างไฟล์สำหรับเผยแพร่

```powershell
npm run lint
npm run build
```

ไฟล์สำหรับเผยแพร่จะอยู่ใน `dist/`; ตั้งค่าเว็บเซิร์ฟเวอร์ให้ส่ง `index.html` สำหรับเส้นทางที่เว็บใช้
