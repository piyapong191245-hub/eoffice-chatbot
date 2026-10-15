'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import ChatbotWidget from '@/components/ChatbotWidget';

export default function Home() {
  useEffect(() => {
    let isMounted = true;

    const autoSyncExcel = async () => {
      try {
        await fetch('/api/sync-excel', {
          method: 'GET',
          cache: 'no-store',
        });
      } catch (err) {
        if (isMounted) {
          console.error('Auto Sync Failed:', err);
        }
      }
    };

    autoSyncExcel();
    const interval = setInterval(autoSyncExcel, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="relative min-h-screen w-full bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* แสงเอฟเฟกต์สีน้ำเงิน-ทองจางๆ หลังฉาก */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center max-w-3xl mb-8">
        {/* โลโก้แบบขยายใหญ่และใส่กรอบสีทองจางๆ */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 mx-auto mb-5 bg-white p-2 rounded-full shadow-2xl border-2 border-amber-300/40 flex items-center justify-center transition-transform hover:scale-105 overflow-hidden">
          <Image
            src="/pacc_logo.png"
            alt="โลโก้ สำนักงาน ป.ป.ท."
            fill
            sizes="(max-width: 640px) 144px, 176px"
            className="object-cover scale-110"
            priority
          />
        </div>

        {/* ข้อความหัวข้อเปลี่ยนเป็นสีทองและขาวให้อ่านง่ายบนพื้นหลังน้ำเงิน */}
        <h1 className="text-2xl sm:text-4xl font-extrabold text-amber-300 mb-2 drop-shadow-md">
          ระบบสารสนเทศ e-Office (สำนักงาน ป.ป.ท.)
        </h1>
        <p className="text-blue-100/90 text-sm sm:text-base font-light">
          ยินดีต้อนรับสู่ระบบสอบถามข้อมูลการจองห้องประชุมและรถยนต์ส่วนกลาง
        </p>
      </div>

      {/* เมนูลัดกลางหน้าจอ (การ์ดกระจกฝ้าตัดกับพื้นหลังน้ำเงิน) */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        <a
          href="https://pacc.eoffice.go.th/room-booking/home"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 bg-white/90 hover:bg-white rounded-2xl shadow-xl border border-blue-200/50 flex items-center gap-3.5 transition-all hover:scale-105 group"
        >
          <span className="text-3xl" role="img" aria-label="ห้องประชุม">
            🏢
          </span>
          <div className="text-left">
            <div className="font-bold text-blue-950 text-sm sm:text-base group-hover:text-blue-700 transition-colors">
              ระบบจองห้องประชุม
            </div>
            <div className="text-xs text-slate-500">ตรวจสอบตารางเวลา / จองห้อง</div>
          </div>
        </a>

        <a
          href="https://pacc.eoffice.go.th/car-reservation/add"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 bg-white/90 hover:bg-white rounded-2xl shadow-xl border border-blue-200/50 flex items-center gap-3.5 transition-all hover:scale-105 group"
        >
          <span className="text-3xl" role="img" aria-label="รถยนต์">
            🚗
          </span>
          <div className="text-left">
            <div className="font-bold text-blue-950 text-sm sm:text-base group-hover:text-blue-700 transition-colors">
              ระบบจองรถยนต์
            </div>
            <div className="text-xs text-slate-500">ขอใช้รถยนต์ส่วนกลาง</div>
          </div>
        </a>
      </div>

      <ChatbotWidget />
    </main>
  );
}