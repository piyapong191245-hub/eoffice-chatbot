import ChatbotWidget from '@/components/ChatbotWidget';

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-2xl font-bold">ระบบจำลองพอร์ทัล e-Office ป.ป.ท.</h1>
      <p className="text-gray-600 mt-2">ทดสอบใช้งานแชทบอทค้นหาข้อมูลการจองห้องประชุม (ปุ่มลอยมุมล่างขวา)</p>

      <ChatbotWidget />
    </main>
  );
}