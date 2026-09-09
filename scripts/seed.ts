// ไฟล์: scripts/seed.ts
import pool from '../lib/db';
import fs from 'fs';
import path from 'path';
import { pipeline } from '@xenova/transformers';

async function getEmbedding(text: string): Promise<number[]> {
  const extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
  const output = await extractor(`passage: ${text}`, {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data);
}

async function runSeed() {
  console.log("🚀 กำลังอ่านข้อมูลห้องประชุมจริงจาก room_info.json...");

  const jsonPath = path.join(process.cwd(), 'public', 'data', 'room_info.json');
  if (!fs.existsSync(jsonPath)) {
    console.error("❌ ไม่พบไฟล์ public/data/room_info.json");
    process.exit(1);
  }

  const roomsData: any[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // เคลียร์ข้อมูลเก่าก่อนลงข้อมูลใหม่
  await pool.query('TRUNCATE TABLE room_embeddings');

  for (const room of roomsData) {
    // -------------------------------------------------------------
    // คำนวณและระบุช่วงความจุอย่างแม่นยำ ไม่ใส่ตัวเลขอื่นปะปน
    // -------------------------------------------------------------
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

    // สร้างข้อความบริบทโดยระบุความจุเป็นตัวเลขเดี่ยวๆ เพื่อความแม่นยำของ Vector
    const contentText = `ห้องประชุม: ${room.name} | ประเภท: ${sizeCategory} | ความจุรองรับได้สูงสุด: ${capacityNum} คน | สถานที่ตั้ง: ${room.location || '-'} | สถานะการใช้งาน: ${room.status || 'พร้อมใช้งาน'}`;
    
    const vector = await getEmbedding(contentText);
    const vectorJson = JSON.stringify(vector);

    await pool.query(
      'INSERT INTO room_embeddings (room_name, content, embedding_json) VALUES ($1, $2, $3)',
      [room.name, contentText, vectorJson]
    );
    console.log(`✅ บันทึกข้อมูลและสร้าง Vector สำหรับห้อง: ${room.name} (${capacityNum} คน) เรียบร้อยแล้ว`);
  }

  console.log("🎉 บันทึกข้อมูล Vector สำหรับห้องจริงทั้งหมดสำเร็จ!");
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("❌ เกิดข้อผิดพลาด:", err);
  process.exit(1);
});