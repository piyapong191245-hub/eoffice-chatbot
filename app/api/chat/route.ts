export const runtime = 'nodejs';
export const maxDuration = 30;

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import pool from '@/lib/db';

function readJsonFile<T = any>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Main Route Handler
// -------------------------------------------------------------
export async function POST(req: Request) {
  let userMessage = '';

  const sendResponse = async (data: { reply: string; actionUrl?: string; carUrl?: string; roomUrl?: string }, status = 200) => {
    if (userMessage) {
      const now = new Date();
      pool.execute('INSERT INTO chat_logs (user_message, bot_reply, created_at) VALUES (?, ?, ?)', [userMessage, data.reply, now])
        .catch((err: any) => console.error("MariaDB Log Error (Skipped):", err.message));
    }
    return NextResponse.json(data, { status });
  };

  try {
    const body = await req.json().catch(() => ({}));
    userMessage = body.message || '';
    const query = userMessage.trim().toLowerCase();

    const cleanQuery = query;
    const globalIgnored = ['ก', 'ข', 'ค', 'ง', 'ส', 'ม', 'เทส', 'test', '5'];

    if (cleanQuery.length > 0 && (cleanQuery.length < 2 || globalIgnored.includes(cleanQuery))) {
      return await sendResponse({
        reply: `ไม่พบข้อมูลที่ตรงกับ "${userMessage}" กรุณาระบุคำค้นหาให้ชัดเจนยิ่งขึ้นครับ`
      });
    }

    const dataDir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(dataDir)) {
      return await sendResponse({ reply: "ไม่พบโฟลเดอร์ public/data/" });
    }

    const formatImageUrl = (url?: string) => {
      if (!url) return '';
      return encodeURI(url).replace(/\(/g, '%28').replace(/\)/g, '%29');
    };

    // -------------------------------------------------------------
    // 0. Greeting Handler
    // -------------------------------------------------------------
    const greetingKeywords = ['สวัสดี', 'สวัสดีครับ', 'สวัสดีค่ะ', 'หวัดดี', 'hi', 'hello', 'สอบถาม', 'เริ่ม'];
    if (greetingKeywords.some((kw) => query === kw || query.includes(kw))) {
      return await sendResponse({
        reply: `สวัสดีครับ! 👋 ผมคือ **PACC e-Office Assistant** ยินดีให้บริการครับ\n\nคุณสามารถพิมพ์สอบถามข้อมูลได้ดังนี้ครับ:\n- **จองห้องประชุม / รถยนต์:** พิมพ์ *"ขอจองห้อง"* หรือ *"ขอจองรถ"*\n- **ค้นหาห้องประชุม:** พิมพ์ชื่อห้อง เช่น *"ห้องประชุม 1"* หรือ *"ขอห้องออนไลน์"*\n- **ค้นหารายการรถ:** พิมพ์ *"รายการรถ"* หรือพิมพ์เลขทะเบียนรถ\n- **ดูสถิติการใช้งาน:** พิมพ์ *"สถิติ"*`
      });
    }

    // -------------------------------------------------------------
    // 1. Vehicle Queries (ระบบรถยนต์)
    // -------------------------------------------------------------
    const vehicleKeywords = ['จองรถ', 'ขอจองรถ', 'ใช้รถ', 'คนขับ', 'พนักงานขับรถ'];
    if (vehicleKeywords.some((kw) => query.includes(kw))) {
      return await sendResponse({
        reply: "กำลังนำท่านไปยังระบบจองรถยนต์...",
        actionUrl: "https://pacc.eoffice.go.th/car-reservation/add"
      });
    }

    const carTypeKeywords = ['ประเภทรถ', 'ชนิดรถ', 'มีรถอะไรบ้าง', 'รถประเภทไหน', 'รถยนต์', 'รถตู้', 'รถกะบะ', 'รถกระบะ', 'รถเก๋ง'];
    if (carTypeKeywords.some((kw) => query === kw || query.includes(kw))) {
      const carsData = readJsonFile<any[]>(path.join(dataDir, 'cars_info.json'));
      if (carsData) {
        let filteredCars: any[] = [];
        if (query.includes('ตู้')) {
          filteredCars = carsData.filter((c) => (c.type || '').includes('ตู้'));
        } else if (query.includes('กะบะ') || query.includes('กระบะ')) {
          filteredCars = carsData.filter((c) => (c.type || '').includes('กะบะ') || (c.type || '').includes('กระบะ'));
        } else if (query.includes('รถยนต์') || query.includes('เก๋ง')) {
          filteredCars = carsData.filter((c) => !(c.type || '').includes('ตู้') && !(c.type || '').includes('กะบะ') && !(c.type || '').includes('กระบะ'));
        }

        if (filteredCars.length > 0) {
          const carList = filteredCars.map((car) => {
            const imageUrl = formatImageUrl(car.image);
            const imgMarkdown = imageUrl ? `![${car.licensePlate || car.license}](${imageUrl})\n` : '';
            return `### 🚗 **ทะเบียน: ${car.licensePlate || car.license}**\n${imgMarkdown}- **ประเภท:** ${car.type || '-'}\n- **รองรับ:** ${car.capacity} ที่นั่ง\n- **ผู้ดูแล:** ${car.caretaker || '-'}\n- **สถานะ:** ${car.status}`;
          }).join('\n\n---\n\n');

          return await sendResponse({
            reply: `🚘 **รายการรถประเภท "${userMessage}" (${filteredCars.length} คัน):**\n\n${carList}\n\n💡 พิมพ์เลขทะเบียนรถเพื่อดูรายละเอียดเพิ่มเติมได้ครับ`
          });
        }
      }

      const carTypesData = readJsonFile<any[]>(path.join(dataDir, 'car_types.json'));
      if (carTypesData) {
        const carTypeList = carTypesData.map((type) => `- **${type.name}** (สถานะ: ${type.status})`).join('\n');
        return await sendResponse({
          reply: `🚘 **ประเภทรถส่วนกลาง สำนักงาน ป.ป.ท.:**\n\n${carTypeList}\n\n💡 พิมพ์คำว่า "ขอจองรถ" เพื่อทำรายการจองรถได้เลยครับ`
        });
      }
    }

    const carsData = readJsonFile<any[]>(path.join(dataDir, 'cars_info.json'));
    if (carsData && query.length >= 2) {
      const matchedCar = carsData.find((car) => {
        const license = (car.licensePlate || car.license || '').toLowerCase().replace(/\s+/g, '');
        const searchKey = query.replace(/\s+/g, '');
        return license && (searchKey.includes(license) || license.includes(searchKey));
      });

      if (matchedCar) {
        const imageUrl = formatImageUrl(matchedCar.image);
        const imgMarkdown = imageUrl ? `![${matchedCar.licensePlate || matchedCar.license}](${imageUrl})\n\n` : '';
        const carId = matchedCar.id || matchedCar.carId || matchedCar.licensePlate || matchedCar.license;

        return await sendResponse({
          reply: `🚗 **ข้อมูลรถยนต์ส่วนกลาง:**\n\n${imgMarkdown}- **ทะเบียน:** ${matchedCar.licensePlate || matchedCar.license}\n- **ประเภท:** ${matchedCar.type || '-'}\n- **จำนวนที่นั่ง:** รองรับ ${matchedCar.capacity} ที่นั่ง\n- **ผู้ดูแลรถ:** ${matchedCar.caretaker || '-'}\n- **สถานะ:** ${matchedCar.status}\n\n💡 สามารถสแกน QR Code เพื่อดูรายละเอียดเพิ่มเติมได้ครับ`,
          carUrl: `https://pacc.eoffice.go.th/car-reservation/car_detail/${encodeURIComponent(carId)}`
        });
      }

      const carListKeywords = ['รายการรถ', 'ข้อมูลรถ', 'รถส่วนกลาง', 'ทะเบียน', 'รถทั้งหมด'];
      if (carListKeywords.some((kw) => query.includes(kw))) {
        const carsList = carsData.map((car) => {
          const imageUrl = formatImageUrl(car.image);
          const imgMarkdown = imageUrl ? `![${car.licensePlate || car.license}](${imageUrl})\n` : '';
          return `### 🚗 **ทะเบียน: ${car.licensePlate || car.license || '-'}**\n${imgMarkdown}- **ประเภท:** ${car.type || '-'}\n- **รองรับ:** ${car.capacity} ที่นั่ง\n- **ผู้ดูแล:** ${car.caretaker || '-'}\n- **สถานะ:** ${car.status}`;
        }).join('\n\n---\n\n');

        return await sendResponse({
          reply: `🏎️ **รายการรถส่วนกลาง สำนักงาน ป.ป.ท. (ทั้งหมด ${carsData.length} คัน):**\n\n${carsList}\n\n💡 พิมพ์เลขทะเบียนรถเพื่อดูรายละเอียดและสแกน QR Code ได้เลยครับ`
        });
      }
    }

    const carReportKeywords = ['รายงานรถ', 'รายงานการใช้รถ', 'ออกรายงาน', 'รายงานคนขับ', 'สถิติรถ', 'ประเมินรถ'];
    if (carReportKeywords.some((kw) => query.includes(kw))) {
      return await sendResponse({
        reply: `📊 **ระบบออกรายงานการใช้รถยนต์ส่วนกลาง**\n\nท่านสามารถเลือกดูหรือออกรายงานในระบบได้ดังนี้ครับ:\n1. 📝 **รายงานการใช้รถยนต์**\n2. 📑 **รายงานพนักงานขับรถปฏิบัติหน้าที่นอกเวลาราชการ**\n3. 👤 **รายงานผลการปฏิบัติงานรายบุคคลของพนักงานขับรถ**\n4. 📈 **รายงานสถิติการขอรับบริการรถยนต์ส่วนกลาง**\n5. ⭐ **รายงานสถิติการประเมินผลการให้บริการรถยนต์**\n\n💡 คลิกที่ปุ่มด้านล่างเพื่อไปยังหน้าออกรายงานและเลือกช่วงเวลา/ดาวน์โหลดไฟล์ (PDF/Excel) ได้ทันทีครับ`,
        actionUrl: "https://pacc.eoffice.go.th/car-reservation/report"
      });
    }

    // -------------------------------------------------------------
    // 2. Room Info Search
    // -------------------------------------------------------------
    const roomsData = readJsonFile<any[]>(path.join(dataDir, 'room_info.json'));
    const excludeZoomKeywords = ['ไม่เอา zoom', 'ไม่เอาซูม', 'ไม่รวม zoom', 'ไม่ใช่ zoom', 'ไม่เอาห้อง zoom', 'ไม่เอาออนไลน์', 'ไม่เอาห้องออนไลน์', 'ไม่รวมออนไลน์'];

    if (roomsData) {
      const isExcludeZoom = excludeZoomKeywords.some((kw) => query.includes(kw));

      const onlineKeywords = ['ระบบการประชุมออนไลน์', 'ประชุมออนไลน์', 'ออนไลน์', 'zoom', 'ขอห้องออนไลน์', 'ขอห้อง zoom'];
      const isOnlineQuery = onlineKeywords.some((kw) => query.includes(kw));
      const hasSpecificRoomNumber = /\d+/.test(query);

      if (isOnlineQuery && !isExcludeZoom && !hasSpecificRoomNumber) {
        const onlineRooms = roomsData.filter((room) =>
          (room.name || '').toLowerCase().includes('zoom') ||
          (room.location || '').toLowerCase().includes('ออนไลน์') ||
          (room.name || '').toLowerCase().includes('ออนไลน์')
        );

        if (onlineRooms.length > 0) {
          const roomList = onlineRooms.map((room) => {
            const imageUrl = formatImageUrl(room.image);
            const imgMarkdown = imageUrl ? `![${room.name}](${imageUrl})\n` : '';
            return `### 🚪 **${room.name}**\n${imgMarkdown}- **สถานที่:** ${room.location}\n- **รองรับ:** ${room.capacity} คน\n- **สถานะ:** ${room.status}`;
          }).join('\n\n---\n\n');

          return await sendResponse({
            reply: `💻 **รายการห้องประชุมระบบออนไลน์ (ทั้งหมด ${onlineRooms.length} ห้อง):**\n\n${roomList}\n\n💡 พิมพ์ชื่อห้องเพื่อดูรายละเอียดเพิ่มเติมได้ครับ`
          });
        }
      }

      const isSmallRoomQuery = ['ห้องเล็ก', 'ขนาดเล็ก', 'คนน้อย', 'ไม่เกิน 10', '5-10', 'ขอห้องเล็ก'].some(kw => query.includes(kw));
      const isLargeRoomQuery = ['ห้องใหญ่', 'ขนาดใหญ่', 'คนเยอะ', 'จุได้เยอะ', 'สัมมนา', 'ขอห้องใหญ่'].some(kw => query.includes(kw));

      if (isSmallRoomQuery || isLargeRoomQuery) {
        let filteredRooms = roomsData.filter((r) => {
          const capacity = parseInt(r.capacity) || 0;
          return isSmallRoomQuery ? capacity <= 15 : capacity > 15;
        });

        if (isExcludeZoom) {
          filteredRooms = filteredRooms.filter((room) =>
            !(room.name || '').toLowerCase().includes('zoom') &&
            !(room.location || '').toLowerCase().includes('ออนไลน์') &&
            !(room.name || '').toLowerCase().includes('ออนไลน์')
          );
        }

        if (filteredRooms.length > 0) {
          const roomList = filteredRooms.map((room) => {
            const imageUrl = formatImageUrl(room.image);
            const imgMarkdown = imageUrl ? `![${room.name}](${imageUrl})\n` : '';
            return `### 🚪 **${room.name}**\n${imgMarkdown}- **สถานที่:** ${room.location}\n- **รองรับ:** ${room.capacity} คน\n- **สถานะ:** ${room.status}`;
          }).join('\n\n---\n\n');

          const title = isSmallRoomQuery
            ? `ห้องประชุมขนาดเล็ก${isExcludeZoom ? " (ไม่รวมห้องออนไลน์)" : ""} (รองรับไม่เกิน 15 คน)`
            : `ห้องประชุมขนาดใหญ่${isExcludeZoom ? " (ไม่รวมห้องออนไลน์)" : ""} (รองรับมากกว่า 15 คน)`;

          return await sendResponse({
            reply: `🏢 **รายการ${title}:**\n\n${roomList}\n\n💡 พิมพ์ชื่อห้องเพื่อดูรายละเอียดและสแกน QR Code ได้เลยครับ`
          });
        }
      }

      let matchedRoom = roomsData.find((room) => room.name.toLowerCase().trim() === query);
      if (!matchedRoom) {
        const isRoomContext = ['ห้อง', 'room', 'ประชุม'].some(k => query.includes(k)) || /^\d+$/.test(query);
        const userNumMatch = query.match(/\d+/);

        if (isRoomContext && userNumMatch) {
          const userNum = userNumMatch[0];
          matchedRoom = roomsData.find((room) => {
            const roomNumMatch = room.name.toLowerCase().match(/\d+/);
            return roomNumMatch ? roomNumMatch[0] === userNum : false;
          });
        }
      }

      if (matchedRoom) {
        const imageUrl = formatImageUrl(matchedRoom.image);
        const imgMarkdown = imageUrl ? `![${matchedRoom.name}](${imageUrl})\n\n` : '';
        let roomId = matchedRoom.id || matchedRoom.roomId;
        if (!roomId) {
          roomId = matchedRoom.name.includes('คณะกรรมการ') ? '81' : '10';
        }

        return await sendResponse({
          reply: `🚪 **${matchedRoom.name}**\n\n${imgMarkdown}- **สถานที่:** ${matchedRoom.location}\n- **รองรับ:** ${matchedRoom.capacity} คน\n- **สถานะ:** ${matchedRoom.status}`,
          roomUrl: `https://pacc.eoffice.go.th/room-booking/room/${roomId}`
        });
      }

      if (excludeZoomKeywords.some((kw) => query === kw)) {
        const onsiteRooms = roomsData.filter((room) =>
          !(room.name || '').toLowerCase().includes('zoom') &&
          !(room.location || '').toLowerCase().includes('ออนไลน์') &&
          !(room.name || '').toLowerCase().includes('ออนไลน์')
        );

        if (onsiteRooms.length > 0) {
          const roomList = onsiteRooms.map((room) => {
            const imageUrl = formatImageUrl(room.image);
            const imgMarkdown = imageUrl ? `![${room.name}](${imageUrl})\n` : '';
            return `### 🚪 **${room.name}**\n${imgMarkdown}- **สถานที่:** ${room.location}\n- **รองรับ:** ${room.capacity} คน\n- **สถานะ:** ${room.status}`;
          }).join('\n\n---\n\n');

          return await sendResponse({
            reply: `🏢 **รายการห้องประชุม ณ อาคาร Software Park (ไม่รวมห้องออนไลน์):**\n\n${roomList}\n\n💡 พิมพ์ชื่อห้องเพื่อดูรายละเอียดเพิ่มเติมได้ครับ`
          });
        }
      }

      if (['ข้อมูลห้อง', 'ห้องประชุมทั้งหมด', 'รายชื่อห้อง', 'รายการห้อง'].some((kw) => query.includes(kw))) {
        const roomList = roomsData.map((room) => {
          const imageUrl = formatImageUrl(room.image);
          const imgMarkdown = imageUrl ? `![${room.name}](${imageUrl})\n` : '';
          return `### 🚪 **${room.name}**\n${imgMarkdown}- **สถานที่:** ${room.location}\n- **รองรับ:** ${room.capacity} คน\n- **สถานะ:** ${room.status}`;
        }).join('\n\n---\n\n');

        return await sendResponse({
          reply: `🏢 **ข้อมูลห้องประชุมทั้งหมด สำนักงาน ป.ป.ท.:**\n\n${roomList}\n\n💡 พิมพ์ชื่อห้องเพื่อดูรายละเอียดและสแกน QR Code ได้เลยครับ`
        });
      }
    }

    // -------------------------------------------------------------
    // 3. Booking Quick Link
    // -------------------------------------------------------------
    const bookingKeywords = ['จองห้อง', 'ขอจองห้อง', 'ต้องการจอง', 'จองห้องประชุม', 'ขอห้อง', 'booking', 'จอง'];
    if (bookingKeywords.some((kw) => query.includes(kw))) {
      const isExcludeZoom = excludeZoomKeywords.some((kw) => query.includes(kw));
      if (!isExcludeZoom) {
        return await sendResponse({
          reply: "กำลังนำท่านไปยังระบบจองห้องประชุม...",
          actionUrl: "https://pacc.eoffice.go.th/room-booking/booking"
        });
      }
    }

    // -------------------------------------------------------------
    // 4. Location Queries
    // -------------------------------------------------------------
    const locationKeywords = ['สถานที่', 'สถานที่ตั้ง', 'รายชื่อชั้น', 'ตึกไหน', 'software park', 'ตั้งอยู่ที่ไหน', 'ชั้น'];
    if (locationKeywords.some((kw) => query === kw || query.includes(kw))) {
      const floorMatch = query.match(/ชั้น\s*(\d+)/) || query.match(/(\d+)\s*ชั้น/);
      if (floorMatch) {
        const targetFloor = floorMatch[1];
        if (roomsData) {
          const roomsOnFloor = roomsData.filter((r) =>
            (r.location || '').includes(`ชั้น ${targetFloor}`) || (r.location || '').includes(`ชั้น${targetFloor}`)
          );

          if (roomsOnFloor.length > 0) {
            const roomList = roomsOnFloor.map((room) => {
              const imageUrl = formatImageUrl(room.image);
              const imgMarkdown = imageUrl ? `![${room.name}](${imageUrl})\n` : '';
              return `### 🚪 **${room.name}**\n${imgMarkdown}- **สถานที่:** ${room.location}\n- **รองรับ:** ${room.capacity} คน\n- **สถานะ:** ${room.status}`;
            }).join('\n\n---\n\n');

            return await sendResponse({
              reply: `🏢 **รายการห้องประชุมประจำ ชั้น ${targetFloor} (${roomsOnFloor.length} ห้อง):**\n\n${roomList}\n\n💡 พิมพ์ชื่อห้องเพื่อดูรายละเอียดและสแกน QR Code ได้เลยครับ`
            });
          }
          return await sendResponse({
            reply: `🏢 ไม่พบห้องประชุมบน **ชั้น ${targetFloor}** ในระบบครับ\n\n💡 สามารถพิมพ์คำว่า "ชั้น" เพื่อดูรายชื่อสถานที่ตั้งห้องประชุมทั้งหมดได้ครับ`
          });
        }
      }

      const locationsData = readJsonFile<any[]>(path.join(dataDir, 'room_locations.json'));
      if (locationsData) {
        const locList = locationsData.map((loc) => `- **${loc.name}** (สถานะ: ${loc.status})`).join('\n');
        return await sendResponse({
          reply: `🏢 **สถานที่ตั้งห้องประชุม สำนักงาน ป.ป.ท. (อาคาร Software Park):**\n\n${locList}\n\n💡 หากต้องการหาห้องประชุมประจำชั้น สามารถพิมพ์ เช่น "ห้องประชุมชั้น 23" ได้เลยครับ`
        });
      }
    }

    // -------------------------------------------------------------
    // 5. Statistics Queries
    // -------------------------------------------------------------
   const statKeywords = ['สถิติ', 'สรุปสถิติ', 'รายงานสถิติ', 'ยอดรวมการใช้งาน', 'สถิติการใช้งาน', 'ประวัติการจอง', 'สถิติยกเลิก', 'สถิติไม่เข้าใช้'];
    if (statKeywords.some((kw) => query.includes(kw))) {
      if (['ไม่เข้าใช้งาน', 'ไม่เข้าใช้', 'noshow', 'no-show'].some(k => query.includes(k))) {
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
      if (fs.existsSync(statPath) && !query.includes('วันที่')) {
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
    // 6. Database Search (MariaDB Query)
    // -------------------------------------------------------------
    const isCarSearch = ['รถ', 'รถยนต์', 'รถตู้', 'ทะเบียน', 'กระบะ', 'กะบะ'].some(kw => query.includes(kw));
    const ignoredKeywords = [
      'ใช้งาน', 'ใช้', 'การใช้งาน', 'ระบบ', 'ทดสอบ', 'test', 'ขอใช้งาน', 'เปิดใช้งาน',
      'สถานะ', 'เช็คสถานะ', 'ป.ป.ท.', 'สำนักงาน', 'ตรวจสอบสถานะ', 'เทส', 'เรื่อง', 'วันที่',
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'สิงหา', 'สิง', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const isIgnoredQuery = ignoredKeywords.some(kw => query === kw);
    if (!isCarSearch && query.length >= 10 && !isIgnoredQuery) {
      try {
        const cleanQuery = query.trim();
        const formattedQuery = cleanQuery.replace(/\s+/g, '%');
        const searchPattern = `%${formattedQuery}%`;
        const exactQueryNoSpace = cleanQuery.replace(/\s+/g, '');

        const [rows]: any = await pool.query(`
          SELECT room_name, booker_name, start_time, end_time, purpose, status 
          FROM room_bookings 
          WHERE room_name LIKE ? 
             OR purpose LIKE ? 
             OR REPLACE(booker_name, ' ', '') = ?
          ORDER BY start_time DESC
          LIMIT 5
        `, [searchPattern, searchPattern, exactQueryNoSpace]);

        if (Array.isArray(rows) && rows.length > 0) {
          const resultText = rows.map((item: any, idx: number) => {
            const startDate = new Date(item.start_time);
            const endDate = new Date(item.end_time);

            const formattedDate = !isNaN(startDate.getTime())
              ? startDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
              : '-';

            const startTimeStr = !isNaN(startDate.getTime())
              ? startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
              : '';
            const endTimeStr = !isNaN(endDate.getTime())
              ? endDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
              : '';

            const timeDisplay = (startTimeStr && endTimeStr) ? ` (${startTimeStr} - ${endTimeStr} น.)` : '';

            let statusText = item.status || 'จองสำเร็จ';
            if (['approved', 'อนุมัติการจอง', 'จองสำเร็จ'].includes(item.status)) {
              statusText = 'จองสำเร็จ';
            } else if (['pending', 'รออนุมัติ'].includes(item.status)) {
              statusText = 'รออนุมัติ';
            }

            return `${idx + 1}. **${item.room_name}**\n` +
              `   - **วันที่:** ${formattedDate}${timeDisplay}\n` +
              `   - **เรื่อง:** ${item.purpose || '-'}\n` +
              `   - **ผู้จอง:** ${item.booker_name || '-'}\n` +
              `   - **สถานะ:** ${statusText}`;
          }).join('\n\n---\n\n');

          return await sendResponse({
            reply: `พบข้อมูลการจองห้องประชุมในระบบ (${rows.length} รายการ):\n\n${resultText}`
          });
        }
      } catch (dbBookingErr) {
        console.error("MariaDB Room Booking Query Error:", dbBookingErr);
      }
    }

    // -------------------------------------------------------------
    // 7. Keyword / Standard Search (ทดแทน AI Semantic Search เดิม)
    // -------------------------------------------------------------
    try {
      const ambiguousKeywords = ['ขอห้อง', 'ห้อง', 'จอง', 'ขอจอง', 'อยากได้ห้อง', 'หาห้อง'];
      const isAmbiguousQuery = ambiguousKeywords.some(kw => query === kw);

      if (query.length >= 3 && !isAmbiguousQuery && !isIgnoredQuery) {
        const searchLike = `%${query}%`;
        const [embeddingRows]: any = await pool.query(
          'SELECT room_name, content FROM room_embeddings WHERE room_name LIKE ? OR content LIKE ? LIMIT 1',
          [searchLike, searchLike]
        );

        if (Array.isArray(embeddingRows) && embeddingRows.length > 0) {
          const bestMatch = embeddingRows[0];
          let roomId = '10';

          if (roomsData) {
            const matched = roomsData.find(r => r.name.includes(bestMatch.room_name) || bestMatch.room_name.includes(r.name));
            if (matched?.id || matched?.roomId) roomId = matched.id || matched.roomId;
          }

          return await sendResponse({
            reply: `🤖 **พบข้อมูลที่ตรงกับความต้องการของคุณ:**\n\n🚪 **${bestMatch.room_name}**\n📍 ${bestMatch.content}`,
            roomUrl: `https://pacc.eoffice.go.th/room-booking/room/${roomId}`
          });
        }
      }
    } catch (fallbackErr) {
      console.error("Database Search Error:", fallbackErr);
    }

    // -------------------------------------------------------------
    // 8. Fallback Response
    // -------------------------------------------------------------
    return await sendResponse({
      reply: `ไม่พบข้อมูลที่ตรงกับ "${userMessage}"\n\n💡 **คำแนะนำการพิมพ์:**\n\n- พิมพ์คำว่า **"ขอจองห้อง"** หรือ **"ขอจองรถ"**\n- พิมพ์คำว่า **"รายการรถ"** หรือ **"ทะเบียนรถ"**\n- พิมพ์คำว่า **"ข้อมูลห้อง"** หรือ **"สถานที่"**\n- กรุณาพิมพ์ชื่อ-นามสกุลจริงให้ครบถ้วน\n- พิมพ์คำว่า **"สถิติ"** เพื่อดูรายงานสรุปยอดการใช้งาน`
    });

  } catch (error: any) {
    return await sendResponse({ reply: "เกิดข้อผิดพลาดในการประมวลผลข้อมูล" }, 500);
  }
}