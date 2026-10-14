export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import pool from '@/lib/db'; // Connection Pool ของ Aiven Cloud MySQL

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { room_name, booker_name, start_time, end_time, purpose } = body;

    // ตรวจสอบความถูกต้องของข้อมูลเบื้องต้น
    if (!room_name || !booker_name || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลการจองห้องประชุมให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // บันทึกข้อมูลการจองลง Aiven Cloud MySQL อัตโนมัติ Real-time
    const [result]: any = await pool.query(
      `INSERT INTO room_bookings (room_name, booker_name, start_time, end_time, purpose, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        room_name,
        booker_name,
        start_time,
        end_time,
        purpose || '-',
        'approved'
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'บันทึกรายการจองห้องประชุมเรียบร้อยแล้ว',
        bookingId: result.insertId
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error saving booking to Aiven MySQL:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลการจอง' },
      { status: 500 }
    );
  }
}