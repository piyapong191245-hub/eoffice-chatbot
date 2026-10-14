export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import pool from '@/lib/db';

// ฟังก์ชันแกะวันที่ที่รองรับสตริงที่มีอักขระขยะภาษาไทย
function parseCleanDateTime(val: any): string | null {
  if (!val) return null;

  const str = String(val).trim();
  
  // ค้นหารูปแบบ วัน/เดือน/ปี เวลา (เช่น 18/08/2569 06:00 หรือ 1ง8/08/2569 06:00)
  // ดึงเฉพาะตัวเลข 2 หลัก / 2 หลัก / 4 หลัก แล้วตามด้วย เวลา
  const match = str.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s+(\d{1,2}):(\d{1,2})/);
  
  if (!match) return null;

  let day = parseInt(match[1], 10);
  let month = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);

  // แปลง พ.ศ. เป็น ค.ศ.
  if (year > 2400) {
    year -= 543;
  }

  const strDay = String(day).padStart(2, '0');
  const strMonth = String(month).padStart(2, '0');
  const strHour = String(hour).padStart(2, '0');
  const strMin = String(minute).padStart(2, '0');

  return `${year}-${strMonth}-${strDay} ${strHour}:${strMin}:00`;
}

export async function GET() {
  try {
    const excelPath = path.join(process.cwd(), 'public', 'data', 'vehicle_booking.xlsx');

    if (!fs.existsSync(excelPath)) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ Excel ใน public/data/vehicle_booking.xlsx' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(excelPath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    // เริ่มอ่านตั้งแต่บรรทัดที่ 2 (ข้ามหัวข้อรายงานและหัวตาราง)
    const rows = rawData.slice(2);
    let insertedCount = 0;

    // ดึงค่า res_id สูงสุด
    const [maxResult]: any = await pool.query(`SELECT MAX(res_id) as maxId FROM vehicle_bookings`);
    let nextId = (maxResult[0]?.maxId || 0) + 1;

    for (const row of rows) {
      if (!row || row.length < 4) continue;

      // ค้นหาคอลัมน์ที่เป็นวันที่เริ่มเดินทางและวันกลับจากแถวข้อมูล
      let dateStart: string | null = null;
      let dateEnd: string | null = null;
      let endLocation = '';
      let description = '-';

      // วนลูปเช็กค่าในแถวเพื่อจับคู่วันที่และจุดหมายปลายทางอย่างแม่นยำ
      const parsedDates: { index: number; formatted: string }[] = [];
      
      row.forEach((cell: any, idx: number) => {
        const parsed = parseCleanDateTime(cell);
        if (parsed) {
          parsedDates.push({ index: idx, formatted: parsed });
        }
      });

      // ต้องพบทั้งวันไปและวันกลับ
      if (parsedDates.length >= 2) {
        dateStart = parsedDates[0].formatted;
        dateEnd = parsedDates[1].formatted;

        const startIdx = parsedDates[0].index;
        const endIdx = parsedDates[1].index;

        // จุดหมายปลายทางอยู่ก่อนหน้าคอลัมน์วันที่เริ่มเดินทาง
        endLocation = row[startIdx - 1] || row[1] || row[2] || '';
        // ชื่อผู้ใช้อยู่ถัดจากคอลัมน์วันที่เดินทางกลับ
        description = row[endIdx + 1] || '-';
      }

      if (!endLocation || !dateStart || !dateEnd) continue;

      // ตรวจสอบข้อมูลซ้ำ
      const [existing]: any = await pool.query(
        `SELECT res_id FROM vehicle_bookings 
         WHERE res_endlocat = ? AND res_datestart = ?`,
        [endLocation, dateStart]
      );

      if (Array.isArray(existing) && existing.length === 0) {
        await pool.query(
          `INSERT INTO vehicle_bookings (res_id, res_endlocat, res_datestart, res_dateend, res_description, res_date)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [nextId, endLocation, dateStart, dateEnd, description]
        );
        nextId++;
        insertedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync ข้อมูลรถยนต์สำเร็จ! เพิ่มรายการใหม่ ${insertedCount} รายการ`
    });

  } catch (error: any) {
    console.error('Vehicle Excel Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}