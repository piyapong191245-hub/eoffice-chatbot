// ไฟล์: scripts/seed.ts
import pool from '../lib/db';
import fs from 'fs';
import path from 'path';

async function runSeed() {
  console.log("🚀 กำลังอ่านข้อมูลห้องประชุมจริงจาก room_info.json...");

  const jsonPath = path.join(process.cwd(), 'public', 'data', 'room_info.json');
  if (!fs.existsSync(jsonPath)) {
    console.error("❌ ไม่พบไฟล์ public/data/room_info.json");
    process.exit(1);
  }

  const roomsData: any[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // เคลียร์ข้อมูลเก่าก่อนลงข้อมูลใหม่ (ปรับชื่อตารางตามที่คุณใช้งานจริง)
  await pool.query('TRUNCATE TABLE room_embeddings');

  for (const room of roomsData) {
    const capacityNum = parseInt(room.capacity) || 0;
    let sizeCategory = '';

    if (capacityNum >= 100) {
      sizeCategory = 'ห้องประชุมขนาดใหญ่พิเศษ จุคนได้หลักร้อยสัมมนาใหญ่';
    } else if (capacityNum >= 30) {
      sizeCategory = 'ห้องประชุมขนาดใหญ่ จุคนได้หลายสิบคน';
    } else if (capacityNum >= 15) {
      sizeCategory = 'ห้องประชุมขนาดกลาง จุคนได้ประมาณสิบห้าถึงยี่สิบคน';
    } else {
      sizeCategory = 'ห้องประชุมขนาดเล็ก มินิ จุคนได้ไม่เกินสิบคน';
    }

    const contentText = `ห้องประชุม: ${room.name} | ประเภท: ${sizeCategory} | ความจุรองรับได้สูงสุด: ${capacityNum} คน | สถานที่ตั้ง: ${room.location || '-'} | สถานะการใช้งาน: ${room.status || 'พร้อมใช้งาน'}`;
    
    // บันทึกข้อมูลลงฐานข้อมูลโดยตรงโดยไม่ต้องสร้าง Vector
    await pool.query(
      'INSERT INTO room_embeddings (room_name, content, embedding_json) VALUES ($1, $2, $3)',
      [room.name, contentText, null] // ส่งค่า embedding_json เป็น null
    );
    console.log(`✅ บันทึกข้อมูลห้อง: ${room.name} (${capacityNum} คน) เรียบร้อยแล้ว`);
  }

  console.log("🎉 บันทึกข้อมูลห้องทั้งหมดสำเร็จแบบไม่ใช้ AI!");
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("❌ เกิดข้อผิดพลาด:", err);
  process.exit(1);
});