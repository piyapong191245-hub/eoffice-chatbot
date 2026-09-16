const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

async function importBookings() {
  // 1. ตั้งค่าเชื่อมต่อ MariaDB (ปรับเปลี่ยน user/password/database ตามเครื่องของคุณ)
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'eoffice_db'
  });

  console.log('🚀 กำลังเชื่อมต่อฐานข้อมูล และเริ่มนำเข้าข้อมูล...');

  // 2. ค้นหาไฟล์ room_booking.csv
  let csvPath = path.join(__dirname, 'room_booking.csv');
  if (!fs.existsSync(csvPath)) {
    csvPath = path.join(os.homedir(), 'Downloads', 'room_booking.csv');
  }

  if (!fs.existsSync(csvPath)) {
    console.error('❌ ไม่พบไฟล์ room_booking.csv');
    process.exit(1);
  }

  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    // แยกคอลัมน์จาก CSV
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const cleanVal = (val) => val ? val.replace(/^"|"$/g, '').trim() : '';

    const id = parseInt(cleanVal(cols[0]));
    if (isNaN(id)) continue; // ข้ามบรรทัด Header

    const rawDate = cleanVal(cols[1]);     // เช่น 2025-06-18
    const timeRange = cleanVal(cols[2]);   // เช่น 13:00-16:30
    const roomName = cleanVal(cols[3]);
    const purpose = cleanVal(cols[4]);
    const bookerName = cleanVal(cols[8]);
    const status = cleanVal(cols[11]);

    // แปลงช่วงเวลาเป็น start_time และ end_time (DATETIME)
    let startTime = `${rawDate} 08:00:00`;
    let endTime = `${rawDate} 17:00:00`;

    if (timeRange && timeRange.includes('-')) {
      const times = timeRange.split('-');
      const startStr = times[0].replace(/[^0-9:]/g, '').trim();
      const endStr = times[1].replace(/[^0-9:]/g, '').trim();

      if (startStr) startTime = `${rawDate} ${startStr.length === 5 ? startStr + ':00' : startStr}`;
      if (endStr) endTime = `${rawDate} ${endStr.length === 5 ? endStr + ':00' : endStr}`;
    }

    // Insert ข้อมูลเข้าตาราง room_bookings
    await connection.execute(`
      INSERT INTO room_bookings (id, room_name, booker_name, start_time, end_time, purpose, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        room_name = VALUES(room_name),
        booker_name = VALUES(booker_name),
        start_time = VALUES(start_time),
        end_time = VALUES(end_time),
        purpose = VALUES(purpose),
        status = VALUES(status)
    `, [id, roomName, bookerName, startTime, endTime, purpose, status]);

    count++;
  }

  console.log(`✅ นำเข้าข้อมูลเข้าตาราง room_bookings สำเร็จทั้งหมด ${count} รายการ!`);
  await connection.end();
}

importBookings().catch(console.error);