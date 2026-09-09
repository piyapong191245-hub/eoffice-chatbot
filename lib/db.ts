import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // ปิด SSL เพื่อเชื่อมต่อกับ Supabase Pooler
  connectionTimeoutMillis: 5000,
});

export default pool;