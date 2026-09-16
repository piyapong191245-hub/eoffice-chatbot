import mysql, { Pool } from 'mysql2/promise';

// ประกาศ Type ให้ตัวแปร global เพื่อป้องกัน TypeScript ฟ้อง Error
declare global {
  var _mysqlPool: Pool | undefined;
}

let pool: Pool;

if (!global._mysqlPool) {
  global._mysqlPool = mysql.createPool({
    host: process.env.MARIADB_HOST || 'localhost',
    user: process.env.MARIADB_USER || 'root',
    password: process.env.MARIADB_PASSWORD || '',
    database: process.env.MARIADB_DATABASE || 'eoffice_db',
    port: Number(process.env.MARIADB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  });
}

pool = global._mysqlPool;

export default pool;