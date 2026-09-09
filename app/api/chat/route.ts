import { NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';
import pool from '@/lib/db'; // นำเข้าตัวเชื่อมต่อ PostgreSQL ในเครื่อง
const { pipeline } = await import('@xenova/transformers');

// -------------------------------------------------------------
// ระบบ AI Embedding Pipeline (รันบน Local Machine ฟรี 100%)
// -------------------------------------------------------------
class EmbeddingPipeline {
  static instance: any = null;

  static async getInstance() {
    if (this.instance === null) {
      // โหลดโมเดล multilingual-e5-small ภาษาไทย
      this.instance = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
    }
    return this.instance;
  }
}

async function getEmbedding(text: string, isQuery: boolean = true): Promise<number[]> {
  const extractor = await EmbeddingPipeline.getInstance();
  const prefix = isQuery ? 'query: ' : 'passage: ';
  const output = await extractor(`${prefix}${text}`, {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data);
}

// ฟังก์ชันคำนวณ Cosine Similarity ระหว่าง 2 Vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// -------------------------------------------------------------
// Main Route Handler
// -------------------------------------------------------------
export async function POST(req: Request) {
  let userMessage = '';

  // ฟังก์ชันช่วยส่ง JSON Response พร้อมบันทึก Log ลง PostgreSQL ในเครื่อง
  const sendResponse = async (data: { reply: string; actionUrl?: string; carUrl?: string; roomUrl?: string }, status = 200) => {
    try {
      // บันทึก Log การสนทนาลง PostgreSQL (ตาราง chat_logs)
      await pool.query(
        'INSERT INTO chat_logs (user_message, bot_reply) VALUES ($1, $2)',
        [userMessage, data.reply]
      );
    } catch (dbErr) {
      console.error("PostgreSQL Log Error:", dbErr);
    }
    return NextResponse.json(data, { status });
  };

  try {
    const { message } = await req.json();
    userMessage = message || '';
    const query = userMessage.trim().toLowerCase();

    const dataDir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(dataDir)) {
      return await sendResponse({ reply: "ไม่พบโฟลเดอร์ public/data/" });
    }

    // ฟังก์ชันช่วยจัดการ URL รูปภาพ (รองรับภาษาไทย เว้นวรรค และวงเล็บ)
    const formatImageUrl = (url?: string) => {
      if (!url) return '';
      return encodeURI(url).replace(/\(/g, '%28').replace(/\)/g, '%29');
    };

    // -------------------------------------------------------------
    // 0. ดักจับคำทักทายทั่วไป (Greeting Handler)
    // -------------------------------------------------------------
    const greetingKeywords = ['สวัสดี', 'สวัสดีครับ', 'สวัสดีค่ะ', 'หวัดดี', 'hi', 'hello', 'สอบถาม', 'เริ่ม'];
    const isGreeting = greetingKeywords.some((kw) => query === kw || query.includes(kw));

    if (isGreeting) {
      return await sendResponse({
        reply: `สวัสดีครับ! 👋 ผมคือ **PACC e-Office Assistant** ยินดีให้บริการครับ\n\nคุณสามารถพิมพ์สอบถามข้อมูลได้ดังนี้ครับ:\n- **จองห้องประชุม / รถยนต์:** พิมพ์ *"ขอจองห้อง"* หรือ *"ขอจองรถ"*\n- **ค้นหาห้องประชุม:** พิมพ์ชื่อห้อง เช่น *"ห้องประชุม 1"* หรือ *"ระบบการประชุมออนไลน์"*\n- **ค้นหารายการรถ:** พิมพ์ *"รายการรถ"* หรือพิมพ์เลขทะเบียนรถ\n- **ดูสถิติการใช้งาน:** พิมพ์ *"สถิติ"*`
      });
    }

    // -------------------------------------------------------------
    // 1. ระบบจองรถยนต์ / ประเภทรถ / รายการรถส่วนกลาง / ค้นหาทะเบียน
    // -------------------------------------------------------------
    const vehicleKeywords = ['จองรถ', 'ขอจองรถ', 'ใช้รถ', 'คนขับ', 'พนักงานขับรถ'];
    const isVehicleBookingQuery = vehicleKeywords.some((kw) => query.includes(kw));

    if (isVehicleBookingQuery) {
      return await sendResponse({
        reply: "กำลังนำท่านไปยังระบบจองรถยนต์...",
        actionUrl: "https://pacc.eoffice.go.th/car-reservation/add"
      });
    }

    // 1.1 ค้นหาประเภทรถ หรือ พิมพ์ชื่อประเภทรถเฉพาะเจาะจง (เช่น รถยนต์, รถตู้, รถกะบะ)
    const carTypeKeywords = ['ประเภทรถ', 'ชนิดรถ', 'มีรถอะไรบ้าง', 'รถประเภทไหน', 'รถยนต์', 'รถตู้', 'รถกะบะ', 'รถกระบะ', 'รถเก๋ง'];
    const isCarTypeQuery = carTypeKeywords.some((kw) => query === kw || query.includes(kw));

    if (isCarTypeQuery) {
      const carInfoPath = path.join(dataDir, 'cars_info.json');
      
      // กรณีพิมพ์ระบุประเภทรถเฉพาะ เช่น "รถยนต์", "รถตู้", "รถกะบะ"
      if (fs.existsSync(carInfoPath)) {
        const carsData: any[] = JSON.parse(fs.readFileSync(carInfoPath, 'utf-8'));
        
        let filteredCars: any[] = [];

        if (query.includes('ตู้')) {
          filteredCars = carsData.filter((c: any) => (c.type || '').includes('ตู้'));
        } else if (query.includes('กะบะ') || query.includes('กระบะ')) {
          filteredCars = carsData.filter((c: any) => (c.type || '').includes('กะบะ') || (c.type || '').includes('กระบะ'));
        } else if (query.includes('รถยนต์') || query.includes('เก๋ง')) {
          // ถ้าพิมพ์ "รถยนต์" ให้ดึงรถนั่งส่วนบุคคล/รถเก๋ง หรือรถที่ไม่ใช่ตู้และกะบะ
          filteredCars = carsData.filter((c: any) => 
            !(c.type || '').includes('ตู้') && !(c.type || '').includes('กะบะ') && !(c.type || '').includes('กระบะ')
          );
        }

        if (filteredCars.length > 0) {
          const carList = filteredCars.map((car: any) => {
            const imageUrl = formatImageUrl(car.image);
            const imgMarkdown = imageUrl ? `![${car.licensePlate || car.license}](${imageUrl})\n` : '';
            return `### 🚗 **ทะเบียน: ${car.licensePlate || car.license}**\n${imgMarkdown}- **ประเภท:** ${car.type || '-'}\n- **รองรับ:** ${car.capacity} ที่นั่ง\n- **ผู้ดูแล:** ${car.caretaker || '-'}\n- **สถานะ:** ${car.status}`;
          }).join('\n\n---\n\n');

          return await sendResponse({
            reply: `🚘 **รายการรถประเภท "${userMessage}" (${filteredCars.length} คัน):**\n\n${carList}\n\n💡 พิมพ์เลขทะเบียนรถเพื่อดูรายละเอียดเพิ่มเติมได้ครับ`
          });
        }
      }

      // กรณีถามคำว่า "ประเภทรถ" แบบภาพรวมทั่วไป
      const carTypePath = path.join(dataDir, 'car_types.json');
      if (fs.existsSync(carTypePath)) {
        const carTypesData: any[] = JSON.parse(fs.readFileSync(carTypePath, 'utf-8'));
        const carTypeList = carTypesData
          .map((type: any) => `- **${type.name}** (สถานะ: ${type.status})`)
          .join('\n');

        return await sendResponse({
          reply: `🚘 **ประเภทรถส่วนกลาง สำนักงาน ป.ป.ท.:**\n\n${carTypeList}\n\n💡 พิมพ์คำว่า "ขอจองรถ" เพื่อทำรายการจองรถได้เลยครับ`
        });
      }
    }

    // 1.2 ค้นหารายการรถ / ค้นหาเฉพาะทะเบียนรถ (อ่านจาก cars_info.json)
    const carInfoPath = path.join(dataDir, 'cars_info.json');
    if (fs.existsSync(carInfoPath)) {
      const carsData: any[] = JSON.parse(fs.readFileSync(carInfoPath, 'utf-8'));

      const matchedCar = carsData.find((car: any) => {
        const license = (car.licensePlate || car.license || '').toLowerCase().replace(/\s+/g, '');
        const searchKey = query.replace(/\s+/g, '');
        return license && (searchKey.includes(license) || license.includes(searchKey));
      });

      if (matchedCar) {
        const imageUrl = formatImageUrl(matchedCar.image);
        const imgMarkdown = imageUrl ? `![${matchedCar.licensePlate || matchedCar.license}](${imageUrl})\n\n` : '';

        const carId = matchedCar.id || matchedCar.carId || matchedCar.licensePlate || matchedCar.license;
        const carDetailUrl = `https://pacc.eoffice.go.th/car-reservation/car_detail/${encodeURIComponent(carId)}`;

        return await sendResponse({
          reply: `🚗 **ข้อมูลรถยนต์ส่วนกลาง:**\n\n${imgMarkdown}- **ทะเบียน:** ${matchedCar.licensePlate || matchedCar.license}\n- **ประเภท:** ${matchedCar.type || '-'}\n- **จำนวนที่นั่ง:** รองรับ ${matchedCar.capacity} ที่นั่ง\n- **ผู้ดูแลรถ:** ${matchedCar.caretaker || '-'}\n- **สถานะ:** ${matchedCar.status}\n\n💡 สามารถสแกน QR Code เพื่อดูรายละเอียดเพิ่มเติมได้ครับ`,
          carUrl: carDetailUrl
        });
      }

      // กรณีขอดูรายการรถทั้งหมด
      const carListKeywords = ['รายการรถ', 'ข้อมูลรถ', 'รถส่วนกลาง', 'ทะเบียน', 'รถทั้งหมด'];
      const isCarListQuery = carListKeywords.some((kw) => query.includes(kw));

      if (isCarListQuery) {
        const carsList = carsData
          .map((car: any) => {
            const imageUrl = formatImageUrl(car.image);
            const imgMarkdown = imageUrl ? `![${car.licensePlate || car.license}](${imageUrl})\n` : '';
            const licenseName = car.licensePlate || car.license || '-';

            return `### 🚗 **ทะเบียน: ${licenseName}**\n${imgMarkdown}- **ประเภท:** ${car.type || '-'}\n- **รองรับ:** ${car.capacity} ที่นั่ง\n- **ผู้ดูแล:** ${car.caretaker || '-'}\n- **สถานะ:** ${car.status}`;
          })
          .join('\n\n---\n\n');

        return await sendResponse({
          reply: `🏎️ **รายการรถส่วนกลาง สำนักงาน ป.ป.ท. (ทั้งหมด ${carsData.length} คัน):**\n\n${carsList}\n\n💡 พิมพ์เลขทะเบียนรถเพื่อดูรายละเอียดและสแกน QR Code ได้เลยครับ`
        });
      }
    }

    // -------------------------------------------------------------
    // 2. ตรวจสอบการถามเรื่อง "จองห้อง / ขอจอง / ต้องการจอง"
    // -------------------------------------------------------------
    const bookingKeywords = ['จองห้อง', 'ขอจองห้อง', 'ต้องการจอง', 'จองห้องประชุม', 'booking'];
    const isBookingQuery = bookingKeywords.some((kw) => query.includes(kw));

    if (isBookingQuery) {
      return await sendResponse({
        reply: "กำลังนำท่านไปยังระบบจองห้องประชุม...",
        actionUrl: "https://pacc.eoffice.go.th/room-booking/booking"
      });
    }

    // -------------------------------------------------------------
    // 3. ตรวจสอบการถาม "สถานที่ / อาคาร / ชั้น"
    // -------------------------------------------------------------
    const locationKeywords = ['สถานที่', 'สถานที่ตั้ง', 'รายชื่อชั้น', 'ตึกไหน', 'software park', 'ตั้งอยู่ที่ไหน', 'ชั้น'];
    const isLocationQuery = locationKeywords.some((kw) => query === kw || query.includes(kw));

    if (isLocationQuery) {
      // 3.1 กรณีระบุเลขชั้น เช่น "ชั้น 14" หรือ "อาคาร SoftwarePark ชั้น 14"
      const floorMatch = query.match(/ชั้น\s*(\d+)/) || query.match(/(\d+)\s*ชั้น/);
      if (floorMatch) {
        const targetFloor = floorMatch[1]; // ดึงตัวเลขชั้นออกมา เช่น "14"
        const roomInfoPath = path.join(dataDir, 'room_info.json');

        if (fs.existsSync(roomInfoPath)) {
          const roomsData: any[] = JSON.parse(fs.readFileSync(roomInfoPath, 'utf-8'));
          
          // กรองหาห้องประชุมที่มีสถานที่ตั้งตรงกับเลขชั้นที่พิมพ์
          const roomsOnFloor = roomsData.filter((r: any) => 
            (r.location || '').includes(`ชั้น ${targetFloor}`) || (r.location || '').includes(`ชั้น${targetFloor}`)
          );

          if (roomsOnFloor.length > 0) {
            const roomList = roomsOnFloor.map((room: any) => {
              const imageUrl = formatImageUrl(room.image);
              const imgMarkdown = imageUrl ? `![${room.name}](${imageUrl})\n` : '';
              return `### 🚪 **${room.name}**\n${imgMarkdown}- **สถานที่:** ${room.location}\n- **รองรับ:** ${room.capacity} คน\n- **สถานะ:** ${room.status}`;
            }).join('\n\n---\n\n');

            return await sendResponse({
              reply: `🏢 **รายการห้องประชุมประจำ ชั้น ${targetFloor} (${roomsOnFloor.length} ห้อง):**\n\n${roomList}\n\n💡 พิมพ์ชื่อห้องเพื่อดูรายละเอียดและสแกน QR Code ได้เลยครับ`
            });
          } else {
            return await sendResponse({
              reply: `🏢 ไม่พบห้องประชุมบน **ชั้น ${targetFloor}** ในระบบครับ\n\n💡 สามารถพิมพ์คำว่า "ชั้น" เพื่อดูรายชื่อสถานที่ตั้งห้องประชุมทั้งหมดได้ครับ`
            });
          }
        }
      }

      // 3.2 กรณีถามภาพรวมสถานที่ตั้ง (ไม่ได้ระบุตัวเลขชั้น)
      const locPath = path.join(dataDir, 'room_locations.json');
      if (fs.existsSync(locPath)) {
        const locationsData = JSON.parse(fs.readFileSync(locPath, 'utf-8'));
        const locList = locationsData
          .map((loc: any) => `- **${loc.name}** (สถานะ: ${loc.status})`)
          .join('\n');

        return await sendResponse({
          reply: `🏢 **สถานที่ตั้งห้องประชุม สำนักงาน ป.ป.ท. (อาคาร Software Park):**\n\n${locList}\n\n💡 หากต้องการหาห้องประชุมประจำชั้น สามารถพิมพ์ เช่น "ห้องประชุมชั้น 23" ได้เลยครับ`
        });
      }
    }

    // -------------------------------------------------------------
    // 4. ตรวจสอบการถาม "สถิติ / ยอดรวม / ขอยกเลิก / ไม่เข้าใช้งาน"
    // -------------------------------------------------------------
    const statKeywords = [
      'สถิติ', 'สรุป', 'รวม', 'ยอดรวม', 'รายงาน',
      'กี่ครั้ง', 'กี่รายการ', 'เท่าไหร่', 'เท่าไร',
      'ปี 68', 'ปี 69', '2568', '2569', 'ประวัติ',
      'ยกเลิก', 'ไม่เข้าใช้งาน', 'ไม่เข้าใช้', 'no-show', 'noshow'
    ];

    const isStatQuery = statKeywords.some((kw) => query.includes(kw));

    if (isStatQuery) {
      if (query.includes('ไม่เข้าใช้งาน') || query.includes('ไม่เข้าใช้') || query.includes('noshow') || query.includes('no-show')) {
        return await sendResponse({
          reply: `📊 **รายงานสถิติการไม่เข้าใช้งานห้องประชุม**\n\n- **ช่วงเวลาที่กำหนด:** 31 ธันวาคม 2567 ถึง 31 ธันวาคม 2570 (2024/12/31 - 2027/12/31)\n- **จำนวนรวมที่ไม่เข้าใช้งาน:** **29** ครั้ง\n\n💡 พิมพ์คำว่า "สถิติ" เพื่อดูรายงานภาพรวมทั้งหมดได้ครับ`
        });
      }

      if (query.includes('ยกเลิก')) {
        return await sendResponse({
          reply: `📊 **รายงานสถิติการขอยกเลิกใช้งานห้องประชุม**\n\n- **ช่วงเวลาที่กำหนด:** 18 สิงหาคม 2569 - 31 ธันวาคม 2570\n- **รายการขอยกเลิกทั้งหมด:** **15** รายการ\n\n💡 พิมพ์คำว่า "สถิติ" เพื่อดูรายงานการใช้งานภาพรวมทั้งหมดได้ครับ`
        });
      }

      const statPath = path.join(dataDir, 'room_stat.xlsx');
      if (fs.existsSync(statPath)) {
        const fileBuffer = fs.readFileSync(statPath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const statData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (statData.length > 0) {
          const row = statData[0];
          const val2568 = row['2568'] || row['__EMPTY'] || Object.values(row)[1] || '1,359';
          const val2569 = row['2569'] || row['__EMPTY_1'] || Object.values(row)[2] || '1,926';

          return await sendResponse({
            reply: `📊 **รายงานสถิติการใช้งานห้องประชุม สำนักงาน ป.ป.ท.**\n\n- **ปี 2568:** มีการใช้งานทั้งหมด **${val2568}** ครั้ง\n- **ปี 2569:** มีการใช้งานทั้งหมด **${val2569}** ครั้ง\n- **สถิติขอยกเลิกใช้งาน (18 ส.ค. 69 - 31 ธ.ค. 70):** **15** รายการ\n- **สถิติไม่เข้าใช้งาน (31 ธ.ค. 67 - 31 ธ.ค. 70):** **29** ครั้ง\n\n💡 ต้องการดูรายการจองเฉพาะห้องหรือค้นหาชื่อผู้จอง สามารถพิมพ์ค้นหาได้เลยครับ`
          });
        }
      }
    }

    // -------------------------------------------------------------
    // 5. ตรวจสอบการถาม "ข้อมูลห้อง / รายชื่อห้อง / ห้องประชุมออนไลน์" จากไฟล์ room_info.json
    // -------------------------------------------------------------
    const roomInfoPath = path.join(dataDir, 'room_info.json');
    if (fs.existsSync(roomInfoPath)) {
      const roomsData: any[] = JSON.parse(fs.readFileSync(roomInfoPath, 'utf-8'));

      // 5.0 ตรวจจับกรณีพิมพ์คำปฏิเสธ Zoom/ออนไลน์ เพื่อดึงเฉพาะห้องประชุม On-site
      const excludeZoomKeywords = ['ไม่เอา zoom', 'ไม่เอาซูม', 'ไม่รวม zoom', 'ไม่ใช่ zoom', 'ไม่เอาห้อง zoom', 'ไม่เอาออนไลน์'];
      const isExcludeOnlyQuery = excludeZoomKeywords.some((kw) => query === kw || query.includes(kw));

      if (isExcludeOnlyQuery) {
        // กรองเอาเฉพาะห้องที่ไม่ใช่ Zoom และไม่อยู่ในสถานที่ตั้งออนไลน์
        const onsiteRooms = roomsData.filter((room: any) => 
          !(room.name || '').toLowerCase().includes('zoom') && 
          !(room.location || '').toLowerCase().includes('ออนไลน์') &&
          !(room.name || '').toLowerCase().includes('ออนไลน์')
        );

        if (onsiteRooms.length > 0) {
          const roomList = onsiteRooms.map((room: any) => {
            const imageUrl = formatImageUrl(room.image);
            const imgMarkdown = imageUrl ? `![${room.name}](${imageUrl})\n` : '';

            return `### 🚪 **${room.name}**\n${imgMarkdown}- **สถานที่:** ${room.location}\n- **รองรับ:** ${room.capacity} คน\n- **สถานะ:** ${room.status}`;
          }).join('\n\n---\n\n');

          return await sendResponse({
            reply: `🏢 **รายการห้องประชุม ณ อาคาร Software Park (ไม่รวมห้องออนไลน์):**\n\n${roomList}\n\n💡 พิมพ์ชื่อห้องเพื่อดูรายละเอียดเพิ่มเติมได้ครับ`
          });
        }
      }

      // 5.1 ตรวจสอบคำค้นหาเกี่ยวกับ "ออนไลน์ / zoom / ระบบการประชุมออนไลน์"
      const onlineKeywords = ['ระบบการประชุมออนไลน์', 'ประชุมออนไลน์', 'ออนไลน์', 'zoom'];
      const isOnlineQuery = onlineKeywords.some((kw) => query.includes(kw));

      if (isOnlineQuery) {
        // กรองเอาเฉพาะห้องที่มีชื่อหรือสถานที่ตั้งเกี่ยวกับ Zoom หรือ ออนไลน์
        const onlineRooms = roomsData.filter((room: any) => 
          (room.name || '').toLowerCase().includes('zoom') || 
          (room.location || '').toLowerCase().includes('ออนไลน์') ||
          (room.name || '').toLowerCase().includes('ออนไลน์')
        );

        if (onlineRooms.length > 0) {
          const roomList = onlineRooms.map((room: any) => {
            const imageUrl = formatImageUrl(room.image);
            const imgMarkdown = imageUrl ? `![${room.name}](${imageUrl})\n` : '';

            return `### 🚪 **${room.name}**\n${imgMarkdown}- **สถานที่:** ${room.location}\n- **รองรับ:** ${room.capacity} คน\n- **สถานะ:** ${room.status}`;
          }).join('\n\n---\n\n');

          return await sendResponse({
            reply: `💻 **รายการห้องประชุมระบบออนไลน์ (ทั้งหมด ${onlineRooms.length} ห้อง):**\n\n${roomList}\n\n💡 พิมพ์ชื่อห้องเพื่อดูรายละเอียดเพิ่มเติมได้ครับ`
          });
        }
      }

      // 5.2 ค้นหาแบบตรงชื่อห้องเดี่ยวๆ
      const matchedRoom = roomsData.find((room) =>
        query.includes(room.name.toLowerCase()) || room.name.toLowerCase().includes(query)
      );

      if (matchedRoom) {
        const imageUrl = formatImageUrl(matchedRoom.image);
        const imgMarkdown = imageUrl ? `![${matchedRoom.name}](${imageUrl})\n\n` : '';

        let roomId = matchedRoom.id || matchedRoom.roomId;
        if (!roomId) {
          if (matchedRoom.name.includes('คณะกรรมการ')) roomId = '81';
          else roomId = '10';
        }

        const roomUrl = `https://pacc.eoffice.go.th/room-booking/room/${roomId}`;

        return await sendResponse({
          reply: `🚪 **${matchedRoom.name}**\n\n${imgMarkdown}- **สถานที่:** ${matchedRoom.location}\n- **รองรับ:** ${matchedRoom.capacity} คน\n- **สถานะ:** ${matchedRoom.status}`,
          roomUrl: roomUrl
        });
      }

      // 5.3 ค้นหารายชื่อห้องทั้งหมด
      const roomInfoKeywords = ['ข้อมูลห้อง', 'ห้องประชุมทั้งหมด', 'รายชื่อห้อง', 'รายการห้อง'];
      const isRoomInfoQuery = roomInfoKeywords.some((kw) => query.includes(kw));

      if (isRoomInfoQuery) {
        const roomList = roomsData
          .map((room: any) => {
            const imageUrl = formatImageUrl(room.image);
            const imgMarkdown = imageUrl ? `![${room.name}](${imageUrl})\n` : '';

            return `### 🚪 **${room.name}**\n${imgMarkdown}- **สถานที่:** ${room.location}\n- **รองรับ:** ${room.capacity} คน\n- **สถานะ:** ${room.status}`;
          })
          .join('\n\n---\n\n');

        return await sendResponse({
          reply: `🏢 **ข้อมูลห้องประชุมทั้งหมด สำนักงาน ป.ป.ท.:**\n\n${roomList}\n\n💡 พิมพ์ชื่อห้องเพื่อดูรายละเอียดและสแกน QR Code ได้เลยครับ`
        });
      }
    }
    // -------------------------------------------------------------
    // 6. ค้นหารายการจองห้องประชุมจาก PostgreSQL (ตาราง room_bookings)
    // -------------------------------------------------------------
    const isCarSearch = ['รถ', 'รถยนต์', 'รถตู้', 'ทะเบียน', 'กระบะ', 'กะบะ'].some(kw => query.includes(kw));

    if (!isCarSearch) {
      try {
        // ดึงข้อมูลการจองห้องประชุมจาก PostgreSQL โดยเรียงจาก "เก่าสุดไปล่าสุด" (ORDER BY start_time ASC)
        const bookingResult = await pool.query(`
          SELECT 
            room_name, 
            booker_name, 
            start_time, 
            end_time, 
            purpose, 
            status 
          FROM room_bookings 
          WHERE 
            LOWER(room_name) LIKE $1 OR 
            LOWER(booker_name) LIKE $1 OR 
            LOWER(purpose) LIKE $1 OR
            LOWER(status) LIKE $1
          ORDER BY start_time ASC
        `, [`%${query}%`]);

        if (bookingResult.rows.length > 0) {
          const resultText = bookingResult.rows.map((item: any, idx: number) => {
            const startDate = new Date(item.start_time);
            const endDate = new Date(item.end_time);

            // แปลงรูปแบบวันที่และเวลาให้อ่านง่าย
            const formattedDate = startDate.toLocaleDateString('th-TH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

            const startTimeStr = startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            const endTimeStr = endDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

            const statusText = item.status === 'approved' ? 'อนุมัติ' : item.status;

            return `${idx + 1}. **${item.room_name}**\n   - **วันที่:** ${formattedDate} (${startTimeStr} - ${endTimeStr} น.)\n   - **เรื่อง:** ${item.purpose || '-'}\n   - **ผู้จอง:** ${item.booker_name || '-'}\n   - **สถานะ:** ${statusText}`;
          }).join('\n\n---\n\n');

          return await sendResponse({
            reply: `พบข้อมูลการจองห้องประชุมในระบบ (${bookingResult.rows.length} รายการ):\n\n${resultText}`
          });
        }
      } catch (dbBookingErr) {
        console.error("PostgreSQL Room Booking Query Error:", dbBookingErr);
      }
    }

    // -------------------------------------------------------------
    // 7. AI Semantic Search (ป้องกันคำมั่ว/พิมพ์มั่ว 100%)
    // -------------------------------------------------------------
    try {
      const cleanText = userMessage.trim().toLowerCase();

      // 1. ตรวจจับคำมั่วบนแป้นพิมพ์ภาษาไทย (Keyboard Spam Pattern)
      const isKeyboardSpam = /^[ฟหกด่าสวงผปแอิื์ํี๊็่้๋1-90\-=_+]+$/i.test(cleanText) && 
        !['ห้อง', 'จอง', 'รถ', 'ชั้น', 'สถิติ', 'สอบถาม', 'สแกน', 'ประชุม'].some(k => cleanText.includes(k));

      // 2. ตรวจสอบความยาวและรูปแบบคำ
      const isTooShort = cleanText.length < 2;

      // หากเป็นคำมั่ว ให้ข้าม AI Search แล้วส่งไป Fallback ทันที
      if (!isKeyboardSpam && !isTooShort) {
        const allEmbeddings = await pool.query('SELECT room_name, content, embedding_json FROM room_embeddings');

        if (allEmbeddings.rows.length > 0) {
          const isExcludeZoom = ['ไม่เอา zoom', 'ไม่เอาซูม', 'ไม่รวม zoom', 'ไม่ใช่ zoom', 'ไม่เอาห้อง zoom', 'ไม่เอาออนไลน์'].some(kw => query.includes(kw));

          let filteredRows = allEmbeddings.rows;
          if (isExcludeZoom) {
            filteredRows = filteredRows.filter(row => 
              !row.room_name.toLowerCase().includes('zoom') && 
              !row.content.toLowerCase().includes('ออนไลน์')
            );
          }

          const queryVector = await getEmbedding(userMessage, true);

          const ranked = filteredRows.map((row) => {
            const roomVector: number[] = JSON.parse(row.embedding_json);
            const score = cosineSimilarity(queryVector, roomVector);
            return { ...row, score };
          }).sort((a, b) => b.score - a.score);

          // 3. ตั้งค่า Threshold ไว้ที่ 0.85 (85%) เพื่อให้กรองเฉพาะคำที่มีความหมายใกล้เคียงจริงๆ เท่านั้น
          if (ranked.length > 0 && ranked[0].score >= 0.85) {
            const bestMatch = ranked[0];

            let roomId = '10';
            if (fs.existsSync(roomInfoPath)) {
              const roomsData: any[] = JSON.parse(fs.readFileSync(roomInfoPath, 'utf-8'));
              const matched = roomsData.find(r => r.name.includes(bestMatch.room_name) || bestMatch.room_name.includes(r.name));
              if (matched?.id || matched?.roomId) roomId = matched.id || matched.roomId;
            }

            const roomUrl = `https://pacc.eoffice.go.th/room-booking/room/${roomId}`;

            return await sendResponse({
              reply: `🤖 **พบห้องประชุมที่ตรงกับความต้องการของคุณ:**\n\n🚪 **${bestMatch.room_name}**\n📍 ${bestMatch.content}\n\n💡 *(ระดับความใกล้เคียงของความหมาย: ${(bestMatch.score * 100).toFixed(1)}%)*`,
              roomUrl: roomUrl
            });
          }
        }
      }
    } catch (aiErr) {
      console.error("AI Semantic Search Error:", aiErr);
    }

    // Fallback เมื่อไม่พบข้อมูลใดๆ
    return await sendResponse({
      reply: `ไม่พบข้อมูลที่ตรงกับ "${userMessage}"\n\n💡 **คำแนะนำการพิมพ์:**\n- พิมพ์คำว่า "ขอจองห้อง" หรือ "ขอจองรถ"\n- พิมพ์คำว่า "รายการรถ" หรือ "ทะเบียนรถ"\n- พิมพ์คำว่า "ข้อมูลห้อง" หรือ "สถานที่"\n- พิมพ์คำว่า "สถิติ" เพื่อดูรายงานสรุปยอดการใช้งาน`
    });

  } catch (error: any) {
    return await sendResponse({ reply: "เกิดข้อผิดพลาดในการประมวลผลข้อมูล" }, 500);
  }
}