const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');

async function importEmbeddings() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'eoffice_db',
    charset: 'utf8mb4'
  });

  let csvPath = path.join(__dirname, 'room_embeddings_rows.csv');
  if (!fs.existsSync(csvPath)) csvPath = path.join(__dirname, 'room_embeddings_rows');

  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let count = 0;
  let isHeader = true;

  console.log('⏳ กำลังนำเข้าข้อมูลเข้าตาราง room_embeddings...');

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    if (!line.trim()) continue;

    // Regex แยกคอลัมน์ CSV โดยคงโครงสร้าง JSON และข้อความ multiline
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

    if (cols.length >= 5) {
      const id = parseInt(cols[0].replace(/^"|"$/g, '').trim());
      const roomName = cols[1].replace(/^"|"$/g, '').replace(/""/g, '"').trim();
      const content = cols[2].replace(/^"|"$/g, '').replace(/""/g, '"').trim();
      const embeddingJson = cols[3].replace(/^"|"$/g, '').replace(/""/g, '"').trim();
      const createdAt = cols[4].replace(/^"|"$/g, '').replace('+00', '').trim();

      await connection.execute(
        `INSERT INTO room_embeddings (id, room_name, content, embedding_json, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE room_name=VALUES(room_name), content=VALUES(content), embedding_json=VALUES(embedding_json)`,
        [id, roomName, content, embeddingJson, createdAt]
      );
      count++;
    }
  }

  console.log(`\n✅ นำเข้าข้อมูล room_embeddings สำเร็จครบถ้วนทั้งหมด ${count} รายการ!`);
  await connection.end();
  process.exit(0);
}

importEmbeddings().catch(console.error);