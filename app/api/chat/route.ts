import { NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const query = message.trim().toLowerCase();

    const dataDir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(dataDir)) {
      return NextResponse.json({ reply: "ไม่พบโฟลเดอร์ public/data/" });
    }

    // ฟังก์ชันช่วยจัดการ URL รูปภาพ (รองรับภาษาไทย เว้นวรรค และวงเล็บ)
    const formatImageUrl = (url?: string) => {
      if (!url) return '';
      return encodeURI(url).replace(/\(/g, '%28').replace(/\)/g, '%29');
    };

    // -------------------------------------------------------------
    // 1. ระบบจองรถยนต์ / ประเภทรถ / รายการรถส่วนกลาง / ค้นหาทะเบียน
    // -------------------------------------------------------------
    const vehicleKeywords = ['จองรถ', 'ขอจองรถ', 'ใช้รถ', 'คนขับ', 'พนักงานขับรถ'];
    const isVehicleBookingQuery = vehicleKeywords.some((kw) => query.includes(kw));

    if (isVehicleBookingQuery) {
      return NextResponse.json({
        reply: "กำลังนำท่านไปยังระบบจองรถยนต์...",
        actionUrl: "https://pacc.eoffice.go.th/car-reservation/booking"
      });
    }

    // 1.1 ค้นหาประเภทรถ
    const carTypeKeywords = ['ประเภทรถ', 'ชนิดรถ', 'มีรถอะไรบ้าง', 'รถประเภทไหน'];
    const isCarTypeQuery = carTypeKeywords.some((kw) => query.includes(kw));

    if (isCarTypeQuery) {
      const carTypePath = path.join(dataDir, 'car_types.json');
      if (fs.existsSync(carTypePath)) {
        const carTypesData: any[] = JSON.parse(fs.readFileSync(carTypePath, 'utf-8'));
        const carTypeList = carTypesData
          .map((type: any) => `- **${type.name}** (สถานะ: ${type.status})`)
          .join('\n');

        return NextResponse.json({
          reply: `🚘 **ประเภทรถส่วนกลาง สำนักงาน ป.ป.ท.:**\n\n${carTypeList}\n\n💡 พิมพ์คำว่า "ขอจองรถ" เพื่อทำรายการจองรถได้เลยครับ`
        });
      }
    }

    // 1.2 ค้นหารายการรถ / ค้นหาเฉพาะทะเบียนรถ (อ่านจาก car_info.json)
    const carInfoPath = path.join(dataDir, 'cars_info.json');
    if (fs.existsSync(carInfoPath)) {
      const carsData: any[] = JSON.parse(fs.readFileSync(carInfoPath, 'utf-8'));

      // ตรวจสอบการค้นหาเฉพาะเลขทะเบียนคันใดคันหนึ่ง
      const matchedCar = carsData.find((car: any) => {
        const license = (car.licensePlate || car.license || '').toLowerCase().replace(/\s+/g, '');
        const searchKey = query.replace(/\s+/g, '');
        return license && (searchKey.includes(license) || license.includes(searchKey));
      });

      if (matchedCar) {
        const imageUrl = formatImageUrl(matchedCar.image);
        const imgMarkdown = imageUrl ? `![${matchedCar.licensePlate || matchedCar.license}](${imageUrl})\n\n` : '';

        return NextResponse.json({
          reply: `🚗 **ข้อมูลรถยนต์ส่วนกลาง:**\n\n${imgMarkdown}- **ทะเบียน:** ${matchedCar.licensePlate || matchedCar.license}\n- **ประเภท:** ${matchedCar.type || '-'}\n- **จำนวนที่นั่ง:** รองรับ ${matchedCar.capacity} ที่นั่ง\n- **ผู้ดูแลรถ:** ${matchedCar.caretaker || '-'}\n- **สถานะ:** ${matchedCar.status}\n\n💡 พิมพ์คำว่า "ขอจองรถ" เพื่อทำรายการจองรถได้เลยครับ`
        });
      }

      // ค้นหาภาพรวมรายการรถทั้งหมด
      const carListKeywords = ['รายการรถ', 'ข้อมูลรถ', 'รถส่วนกลาง', 'ทะเบียน', 'รถทั้งหมด', 'ข้อมูละรถ'];
      const isCarListQuery = carListKeywords.some((kw) => query.includes(kw));

      if (isCarListQuery) {
        const carsList = carsData
          .map((car: any) => {
            const imageUrl = formatImageUrl(car.image);
            const imgMarkdown = imageUrl ? `![${car.licensePlate || car.license}](${imageUrl})\n` : '';
            const licenseName = car.licensePlate || car.license || '-';

            return `🚗 **ทะเบียน: ${licenseName}**\n${imgMarkdown}- **ประเภท:** ${car.type || '-'}\n- **รองรับ:** ${car.capacity} ที่นั่ง\n- **ผู้ดูแล:** ${car.caretaker || '-'}\n- **สถานะ:** ${car.status}`;
          })
          .join('\n\n---\n\n');

        return NextResponse.json({
          reply: `🏎️ **รายการรถส่วนกลาง สำนักงาน ป.ป.ท. (ทั้งหมด ${carsData.length} คัน):**\n\n${carsList}\n\n💡 พิมพ์คำว่า "ขอจองรถ" เพื่อทำรายการจองรถได้เลยครับ`
        });
      }
    }

    // -------------------------------------------------------------
    // 2. ตรวจสอบการถามเรื่อง "จองห้อง / ขอจอง / ต้องการจอง"
    // -------------------------------------------------------------
    const bookingKeywords = ['จองห้อง', 'ขอจองห้อง', 'ต้องการจอง', 'จองห้องประชุม', 'booking'];
    const isBookingQuery = bookingKeywords.some((kw) => query.includes(kw));

    if (isBookingQuery) {
      return NextResponse.json({
        reply: "กำลังนำท่านไปยังระบบจองห้องประชุม...",
        actionUrl: "https://pacc.eoffice.go.th/room-booking/booking"
      });
    }

    // -------------------------------------------------------------
    // 3. ตรวจสอบการถาม "สถานที่ / ชั้น / อาคาร"
    // -------------------------------------------------------------
    const locationKeywords = ['สถานที่', 'ชั้น', 'อาคาร', 'software park', 'ตึก', 'ตั้งอยู่ที่ไหน'];
    const isLocationQuery = locationKeywords.some((kw) => query.includes(kw));

    if (isLocationQuery) {
      const locPath = path.join(dataDir, 'room_locations.json');
      if (fs.existsSync(locPath)) {
        const locationsData = JSON.parse(fs.readFileSync(locPath, 'utf-8'));
        const locList = locationsData
          .map((loc: any) => `- **${loc.name}** (สถานะ: ${loc.status})`)
          .join('\n');

        return NextResponse.json({
          reply: `🏢 **สถานที่ตั้งห้องประชุม สำนักงาน ป.ป.ท. (อาคาร Software Park):**\n\n${locList}\n\n💡 สอบถามการจองห้องเฉพาะชั้น สามารถพิมพ์ค้นหาได้เลยครับ`
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
        return NextResponse.json({
          reply: `📊 **รายงานสถิติการไม่เข้าใช้งานห้องประชุม**\n\n- **ช่วงเวลาที่กำหนด:** 31 ธันวาคม 2567 ถึง 31 ธันวาคม 2570 (2024/12/31 - 2027/12/31)\n- **จำนวนรวมที่ไม่เข้าใช้งาน:** **29** ครั้ง\n\n💡 พิมพ์คำว่า "สถิติ" เพื่อดูรายงานภาพรวมทั้งหมดได้ครับ`
        });
      }

      if (query.includes('ยกเลิก')) {
        return NextResponse.json({
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

          return NextResponse.json({
            reply: `📊 **รายงานสถิติการใช้งานห้องประชุม สำนักงาน ป.ป.ท.**\n\n- **ปี 2568:** มีการใช้งานทั้งหมด **${val2568}** ครั้ง\n- **ปี 2569:** มีการใช้งานทั้งหมด **${val2569}** ครั้ง\n- **สถิติขอยกเลิกใช้งาน (18 ส.ค. 69 - 31 ธ.ค. 70):** **15** รายการ\n- **สถิติไม่เข้าใช้งาน (31 ธ.ค. 67 - 31 ธ.ค. 70):** **29** ครั้ง\n\n💡 ต้องการดูรายการจองเฉพาะห้องหรือค้นหาชื่อผู้จอง สามารถพิมพ์ค้นหาได้เลยครับ`
          });
        }
      }
    }

    // -------------------------------------------------------------
    // 5. ตรวจสอบการถาม "ข้อมูลห้อง / รายชื่อห้อง" จากไฟล์ room_info.json
    // -------------------------------------------------------------
    const roomInfoPath = path.join(dataDir, 'room_info.json');
    if (fs.existsSync(roomInfoPath)) {
      const roomsData: any[] = JSON.parse(fs.readFileSync(roomInfoPath, 'utf-8'));

      const matchedRoom = roomsData.find((room) =>
        query.includes(room.name.toLowerCase()) || room.name.toLowerCase().includes(query)
      );

      // ค้นหาห้องเฉพาะเจาะจง 1 ห้อง
      if (matchedRoom) {
        const imageUrl = formatImageUrl(matchedRoom.image);
        const imgMarkdown = imageUrl ? `![${matchedRoom.name}](${imageUrl})\n\n` : '';

        return NextResponse.json({
          reply: `🚪 **${matchedRoom.name}**\n\n${imgMarkdown}- **สถานที่:** ${matchedRoom.location}\n- **รองรับ:** ${matchedRoom.capacity} คน\n- **สถานะ:** ${matchedRoom.status}\n\n💡 พิมพ์คำว่า "ขอจองห้อง" เพื่อไปยังหน้าจองห้องประชุมได้เลยครับ`
        });
      }

      // ค้นหารายชื่อห้องทั้งหมด
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

        return NextResponse.json({
          reply: `🏢 **ข้อมูลห้องประชุมทั้งหมด สำนักงาน ป.ป.ท.:**\n\n${roomList}\n\n💡 พิมพ์ชื่อห้องเพื่อดูรายการจองของห้องนั้นๆ ได้เลยครับ`
        });
      }
    }

    // -------------------------------------------------------------
    // 6. ค้นหารายการจองรายห้องจากไฟล์ room_booking.xlsx
    // -------------------------------------------------------------
    const bookingPath = path.join(dataDir, 'room_booking.xlsx');
    if (fs.existsSync(bookingPath)) {
      const fileBuffer = fs.readFileSync(bookingPath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];

      const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const matchedData = data.filter((row) => {
        return Object.entries(row).some(([key, val]) => {
          if (key.includes('เบอร์') || key.includes('โทร')) return false;
          return String(val).toLowerCase().includes(query);
        });
      });

      if (matchedData.length > 0) {
        const resultText = matchedData.slice(0, 5).map((item, idx) => {
          const room = item['ชื่อห้อง'] || item['ห้อง'] || item['ชื่อห้องประชุม'] || 'ไม่ระบุห้อง';
          const date = item['วันที่ใช้ห้อง'] || item['วันที่จอง'] || item['วันที่'] || '-';
          const time = item['ช่วงเวลาใช้ห้อง'] || item['เวลา'] || '-';
          const topic = item['เรื่อง'] || item['วัตถุประสงค์'] || '-';
          const booker = item['ผู้จอง'] || item['ผู้ขอจอง'] || '-';
          const status = item['สถานะปัจจุบัน'] || item['สถานะ'] || 'อนุมัติ';

          return `${idx + 1}. **${room}**\n   - **วันที่:** ${date} (${time})\n   - **เรื่อง:** ${topic}\n   - **ผู้จอง:** ${booker}\n   - **สถานะ:** ${status}`;
        }).join('\n\n');

        return NextResponse.json({
          reply: `พบข้อมูลการจองห้องประชุมที่เกี่ยวข้อง ${matchedData.length} รายการ:\n\n${resultText}`
        });
      }
    }

    return NextResponse.json({
      reply: `ไม่พบข้อมูลที่ตรงกับ "${message}"\n\n💡 **คำแนะนำการพิมพ์:**\n- พิมพ์คำว่า "ขอจองห้อง" หรือ "ขอจองรถ"\n- พิมพ์คำว่า "รายการรถ" หรือ "ทะเบียนรถ"\n- พิมพ์คำว่า "ข้อมูลห้อง" หรือ "สถานที่"\n- พิมพ์คำว่า "สถิติ" เพื่อดูรายงานสรุปยอดการใช้งาน`
    });

  } catch (error: any) {
    return NextResponse.json({ reply: "เกิดข้อผิดพลาดในการประมวลผลข้อมูล" }, { status: 500 });
  }
}