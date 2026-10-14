'use client';

import { useEffect } from 'react';
import ChatbotWidget from '@/components/ChatbotWidget';

export default function Home() {
  useEffect(() => {
    const autoSyncExcel = async () => {
      try {
        // ใช้ window.location.origin เพื่อระบุ Host และ Port ให้ถูกต้องตามเบราว์เซอร์จริง
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        await fetch(`${baseUrl}/api/sync-excel`, {
          method: 'GET',
          cache: 'no-store'
        });
      } catch (err) {
        console.error('Auto Sync Failed:', err);
      }
    };

    // รันครั้งแรกเมื่อเปิดหน้าเว็บ
    autoSyncExcel();

    // ตั้งเวลา Sync ทุกๆ 10 วินาที
    const interval = setInterval(autoSyncExcel, 10000);

    return () => clearInterval(interval);
  }, []);

  return <ChatbotWidget />;
}