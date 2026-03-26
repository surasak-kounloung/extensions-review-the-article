# HTML Tag & Article Content Reviewer

ส่วนขยาย Chrome สำหรับตรวจสอบแท็ก HTML และโครงสร้างเนื้อหาบนหน้าเว็บ โดยเน้นใช้งานกับหน้าเว็บที่มี element class `entry-content, blog-wrapper, cs-site-content` (เช่น WordPress)

## ฟีเจอร์หลัก

- **แสดงแท็ก HTML** — แสดง badge สีตามหมวดหมู่ของแท็กบนแต่ละ element ในเนื้อหา
- **ตรวจสอบลิงก์ภายนอก** — สแกนและทดสอบว่าลิงก์ที่ชี้ไปภายนอกใช้งานได้หรือไม่ (HTTP HEAD)
- **ตรวจสอบลิงก์หัวข้อ (#)** — ตรวจสอบว่าลิงก์ anchor (`<a href="#id">`) ชี้ไปยัง element ที่มีอยู่จริงหรือไม่
- **ตรวจสอบเส้นคั่นก่อน H2** — ตรวจว่าก่อนแต่ละ `<h2>` มี `<hr>` และ block target ของ Page Scroll to Id (ps2id) ครบหรือไม่

## หมวดหมู่แท็ก (สี)

| หมวดหมู่   | ตัวอย่างแท็ก |
|-----------|---------------|
| โครงสร้าง  | html, body, div, section, article, nav |
| หัวข้อ     | h1–h6 |
| ข้อความ   | p, strong, em, blockquote, code |
| ลิงก์      | a |
| สื่อ      | img, video, audio, iframe, svg |
| ฟอร์ม     | form, input, button, textarea |
| ตาราง     | table, tr, th, td |
| Semantic | details, summary, dialog |

---

## วิธีติดตั้ง

### ติดตั้งแบบ Unpacked (สำหรับผู้พัฒนา)

1. ดาวน์โหลดหรือ clone โปรเจกต์นี้
2. เปิด Chrome แล้วไปที่ `chrome://extensions/`
3. เปิด **Developer mode** (มุมขวาบน)
4. กด **Load unpacked**
5. เลือกโฟลเดอร์โปรเจกต์ `extensions-review-the-article`
6. ส่วนขยายจะถูกเพิ่มเข้า Chrome เรียบร้อย

---

## วิธีใช้งาน

1. ไปที่หน้าเว็บที่ต้องการตรวจสอบ (ควรเป็นหน้าเนื้อหาที่มี class `entry-content, blog-wrapper, cs-site-content`)
2. คลิกไอคอน **HTML Tag & Article Content Reviewer** บน toolbar
3. กดปุ่ม **"เปิดสแกนหน้าเว็บ"**
4. รอการสแกน — ระบบจะ:
   - แสดง badge แท็ก HTML บนหน้าเว็บ
   - ตรวจสอบลิงก์ภายนอก (จะแสดง progress bar ระหว่างรอ)
   - ตรวจสอบลิงก์ anchor (#)
   - ตรวจสอบโครงสร้าง H2 (hr + ps2id ก่อนแต่ละ h2)
5. ดูผลลัพธ์ใน popup:
   - **ผลตรวจสอบลิงก์** — สถานะ OK / เสีย
   - **ตรวจสอบลิงก์หัวข้อ (#)** — ลิงก์ที่ทำงานได้ / ไม่พบ element เป้าหมาย
   - **ตรวจสอบเส้นคั่นก่อน H2** — H2 ที่มีโครงสร้างครบ / ไม่ครบ
6. คลิกรายการที่ **เสีย** หรือ **ไม่ครบ** เพื่อเลื่อนไปยังตำแหน่งบนหน้าเว็บ
7. กด **"ปิดสแกนหน้าเว็บ"** เพื่อปิด badge และย้อนกลับสถานะหน้าเว็บ

---

## โครงสร้างไฟล์

```
extensions-review-the-article/
├── manifest.json      # กำหนดการตั้งค่าส่วนขยาย
├── background.js      # Service worker (ตรวจสอบลิงก์ภายนอก)
├── content.js         # สคริปต์บนหน้าเว็บ (badge แท็ก, ตรวจสอบ anchor/H2)
├── popup.html         # หน้า popup
├── popup.js           # ลอจิก popup
├── popup.css          # สไตล์ popup
└── icons/             # ไอคอน 16, 48, 128 px
```

---

## ความต้องการของระบบ

- **เบราว์เซอร์**: Google Chrome (รองรับ Manifest V3)
- **หน้าเว็บ**: ต้องมี element ที่มี class `entry-content, blog-wrapper, cs-site-content` เพื่อให้ส่วนขยายทำงาน (โดยทั่วไปพบในธีม WordPress)
- **ลิงก์**: การตรวจสอบลิงก์ภายนอกใช้ `fetch` แบบ HEAD — บางโดเมนอาจ block หรือใช้ CORS ทำให้ผลลัพธ์เป็น "OK (no-cors)" แทนสถานะจริง

---

## สิทธิ์ที่ใช้ (Permissions)

- `activeTab` — เข้าถึงแท็บที่เปิดอยู่
- `scripting` — inject สคริปต์ไปยังแท็บ
- `storage` — เก็บผลการตรวจสอบชั่วคราว
- `host_permissions: <all_urls>` — เข้าถึงทุก URL เพื่อตรวจสอบลิงก์และ inject content script

---

## เวอร์ชัน

- **1.0.0** — รุ่นเริ่มต้น
