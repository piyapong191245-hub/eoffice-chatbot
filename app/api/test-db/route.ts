import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    // ทดสอบยิง Query ไปถามเวอร์ชันของ MariaDB
    const [rows] = await pool.query<RowDataPacket[]>('SELECT VERSION() as version, DATABASE() as db_name');
    
    return NextResponse.json({
      status: 'Connected successfully! 🎉',
      database: rows[0].db_name,
      mariaDbVersion: rows[0].version,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'Connection failed ❌',
      error: error.message
    }, { status: 500 });
  }
}