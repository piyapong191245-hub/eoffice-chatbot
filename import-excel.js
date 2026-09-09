const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { Pool } = require('pg');

// 🔑 ตั้งค่าการเชื่อมต่อฐานข้อมูลตรงนี้
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'eoffice_db',
  password: 'Net_0801071720', // 👈 แก้ไขใส่รหัสผ่านตรงนี้ได้เลยครับ
  port: 5432,
});

async function importExcelToPostgres() {
  try {
    const filePath = path.join(__dirname, 'public', 'data', 'room_booking.xlsx');
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ ไม่พบไฟล์ room_booking.xlsx ใน public/data/');
      return;
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });

    console.log(`📦 พบข้อมูลทั้งหมด ${data.length} รายการ กำลังนำเข้าฐานข้อมูล...`);

    for (const row of data) {
      const roomName = row['ชื่อห้อง'] || row['ห้อง'] || row['ชื่อห้องประชุม'] || '';
      const bookerName = row['ผู้จอง'] || row['ผู้ขอจอง'] || '';
      const purpose = row['เรื่อง'] || row['วัตถุประสงค์'] || '';
      const status = row['สถานะปัจจุบัน'] || row['สถานะ'] || 'approved';
      const rawDate = row['วันที่ใช้ห้อง'] || row['วันที่จอง'] || row['วันที่'] || '';
      const rawTime = row['ช่วงเวลาใช้ห้อง'] || row['เวลา'] || '09:00 - 12:00';

      const times = String(rawTime).split('-').map(t => t.trim());
      const startTimeStr = `${rawDate} ${times[0] || '09:00'}`;
      const endTimeStr = `${rawDate} ${times[1] || '12:00'}`;

      await pool.query(
        `INSERT INTO room_bookings (room_name, booker_name, start_time, end_time, purpose, status) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [roomName, bookerName, startTimeStr, endTimeStr, purpose, status]
      );
    }

    console.log('✅ นำเข้าข้อมูลทั้งหมดลง PostgreSQL เรียบร้อยแล้ว!');
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาด:', err);
  } finally {
    await pool.end();
  }
}

importExcelToPostgres();