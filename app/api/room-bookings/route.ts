export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT room_name, booker_name, start_time, end_time, purpose, status 
      FROM room_bookings
      WHERE DATE(start_time) >= CURDATE()
      ORDER BY start_time ASC
    `);
    
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Database query error:', error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}