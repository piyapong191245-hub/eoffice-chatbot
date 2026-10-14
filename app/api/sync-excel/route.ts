export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import pool from '@/lib/db';

export async function GET() {
  try {
    const excelPath = path.join(process.cwd(), 'public', 'data', 'room_booking.xlsx');

    if (!fs.existsSync(excelPath)) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ Excel ใน public/data/room_booking.xlsx' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(excelPath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

    // ข้อมูลจริงเริ่มตั้งแต่ Row index 6 (เนื่องจาก 0-5 เป็นหัวรายงานและหัวตาราง)
    const rows = rawData.slice(6);
    let insertedCount = 0;

    for (const row of rows) {
      if (!row || row.length < 6) continue;

      // ปรับ Index ให้ตรงตามโครงสร้างไฟล์รายงานจริง
      const dateStr = row[2];       // คอลัมน์ C: วันที่ใช้ห้อง (เช่น 2026-08-18)
      const timeRange = row[3];     // คอลัมน์ D: ช่วงเวลาใช้ห้อง (เช่น 07:00-12:00)
      const roomName = row[4];      // คอลัมน์ E: ชื่อห้อง
      const purpose = row[5];       // คอลัมน์ F: เรื่อง / วัตถุประสงค์
      const bookerName = row[9] || '-'; // คอลัมน์ J: ผู้จอง

      if (!dateStr || !timeRange || !roomName) continue;

      const times = String(timeRange).split('-');
      if (times.length < 2) continue;

      const startTime = `${dateStr} ${times[0]?.trim()}:00`;
      const endTime = `${dateStr} ${times[1]?.trim()}:00`;

      // ตรวจสอบข้อมูลซ้ำก่อน INSERT
      const [existing]: any = await pool.query(
        `SELECT id FROM room_bookings 
         WHERE room_name = ? AND start_time = ? AND purpose = ?`,
        [roomName, startTime, purpose]
      );

      if (Array.isArray(existing) && existing.length === 0) {
        await pool.query(
          `INSERT INTO room_bookings (room_name, booker_name, start_time, end_time, purpose, status)
           VALUES (?, ?, ?, ?, ?, 'จองสำเร็จ')`,
          [roomName, bookerName, startTime, endTime, purpose]
        );
        insertedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync สำเร็จ! เพิ่มรายการใหม่ ${insertedCount} รายการ`
    });

  } catch (error: any) {
    console.error('Excel Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}