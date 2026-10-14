export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, userName, roomName, startTime, endTime } = body;

    if (!title || !startTime || !endTime) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    // บันทึกลงตาราง room_bookings ตามชื่อคอลัมน์จริงใน Aiven MySQL
    await pool.query(
      `INSERT INTO room_bookings 
       (room_name, booker_name, start_time, end_time, purpose, status)
       VALUES (?, ?, ?, ?, ?, 'จองสำเร็จ')`,
      [
        roomName || 'ห้องประชุม 2 (ห้องเล็ก)',
        userName || 'ไม่ระบุชื่อ',
        startTime,
        endTime,
        title || 'ทดสอบการจอง'
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'รับข้อมูลและบันทึกลง MySQL สำเร็จ!'
    });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}