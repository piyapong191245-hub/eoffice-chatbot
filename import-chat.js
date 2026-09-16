const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');

async function importCSV() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'eoffice_db',
    charset: 'utf8mb4'
  });

  let csvPath = path.join(__dirname, 'chat_logs_rows.csv');
  if (!fs.existsSync(csvPath)) {
    csvPath = path.join(__dirname, 'chat_logs_rows');
  }

  console.log(`📂 กำลังอ่านไฟล์จาก: ${csvPath}`);

  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let isHeader = true;

  console.log('⏳ กำลังนำเข้าข้อมูลแบบ Streaming...');

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }

    if (!line.trim()) continue;

    // แยกคอลัมน์พื้นฐาน
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

    if (cols.length >= 4) {
      const id = cols[0].replace(/^"|"$/g, '').trim();
      const userMessage = cols[1].replace(/^"|"$/g, '').replace(/""/g, '"');
      const botReply = cols[2].replace(/^"|"$/g, '').replace(/""/g, '"');
      const createdAt = cols[3].replace(/^"|"$/g, '').replace('+00', '').trim();

      try {
        await connection.execute(
          'INSERT INTO chat_logs (id, user_message, bot_reply, created_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE user_message=VALUES(user_message)',
          [id, userMessage, botReply, createdAt]
        );
        count++;
        if (count % 500 === 0) {
          console.log(`  -> นำเข้าแล้ว ${count} รายการ...`);
        }
      } catch (err) {
        // ข้ามแถวที่รูปแบบเวลาหรือ id ไม่ถูกต้อง
      }
    }
  }

  console.log(`\n✅ นำเข้าข้อมูล chat_logs สำเร็จเรียบร้อยทั้งหมด ${count} รายการ!`);
  await connection.end();
  process.exit(0);
}

importCSV().catch(console.error);