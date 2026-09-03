'use client';
import ReactMarkdown from 'react-markdown';
import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, RotateCcw, Building2 } from 'lucide-react';

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    { sender: 'bot', text: 'สวัสดีครับ ผมคือผู้ช่วยระบบจองห้องประชุม e-Office (สำนักงาน ป.ป.ท.)\n\nสามารถสอบถามข้อมูลการจองห้องประชุมได้เลยครับ' }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // เลื่อนหน้าจอลงล่างสุดอัตโนมัติเมื่อมีข้อความใหม่
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (customMessage?: string) => {
    const messageToSend = customMessage || input;
    if (!messageToSend.trim() || loading) return;

    setMessages((prev) => [...prev, { sender: 'user', text: messageToSend }]);
    if (!customMessage) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend }),
      });
      const data = await res.json();

      setMessages((prev) => [...prev, { sender: 'bot', text: data.reply }]);

      // 🚀 สั่งเปิดหน้าเว็บจองห้องในแท็บใหม่ทันทีหากได้รับ actionUrl
      if (data.actionUrl) {
        window.open(data.actionUrl, '_blank', 'noopener,noreferrer');
      }

    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'bot', text: 'ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      { sender: 'bot', text: 'สวัสดีครับ ผมคือผู้ช่วยระบบจองห้องประชุม e-Office (สำนักงาน ป.ป.ท.)\n\nสามารถสอบถามข้อมูลการจองห้องประชุมได้เลยครับ' }
    ]);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      {/* ปุ่มกดเปิดแชท */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-900 hover:bg-blue-800 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 transition-all transform hover:scale-105 border-2 border-amber-400"
        >
          <Building2 className="w-6 h-6 text-amber-400" />
          <span className="font-medium text-sm hidden sm:inline">สอบถามการจองห้องประชุม</span>
        </button>
      )}

      {/* หน้าต่างแชท */}
      {isOpen && (
        <div className="w-90 sm:w-97.5 h-130 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all">

          {/* ส่วนหัว (Header) */}
          <div className="bg-linear-to-r from-blue-950 via-blue-900 to-blue-800 text-white p-3.5 flex justify-between items-center shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="bg-amber-400 p-1.5 rounded-lg text-blue-950">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide text-amber-300">PACC e-Office Assistant</h3>
                <p className="text-[11px] text-blue-200">ระบบสอบถามการจองห้องประชุม</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                title="ล้างประวัติการคุย"
                className="p-1.5 hover:bg-blue-800 rounded-lg text-blue-200 hover:text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-blue-800 rounded-lg text-blue-200 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ส่วนแสดงข้อความ (Messages) */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50 text-xs sm:text-sm">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-2xl max-w-[85%] shadow-sm ${msg.sender === 'user'
                  ? 'bg-blue-900 text-white ml-auto rounded-tr-none'
                  : 'bg-white text-gray-800 mr-auto border border-gray-100 rounded-tl-none'
                  }`}
              >
                {/* ใช้ ReactMarkdown เพื่อแปลงข้อความ มาร์กดาวน์ และ รูปภาพ */}
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-blue-900">{children}</strong>,
                    img: ({ node, ...props }) => (
                      <img
                        {...props}
                        style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', margin: '8px 0', display: 'block' }}
                        alt={props.alt || 'room image'}
                      />
                    ),
                    h3: ({ children }) => <h3 className="font-bold text-sm text-blue-950 my-1">{children}</h3>,
                    hr: () => <hr className="my-2 border-gray-200" />
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>
            ))}

            {/* สถานะกำลังโหลด */}
            {loading && (
              <div className="bg-white text-gray-500 p-3 rounded-2xl rounded-tl-none border border-gray-100 mr-auto max-w-[85%] flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-blue-900 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <span className="text-xs text-gray-400 ml-1">กำลังค้นหาข้อมูล...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ปุ่มคำถามด่วน (Quick Reply Buttons) */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-1.5 overflow-x-auto no-scrollbar text-xs">
            <button
              onClick={() => handleSend('ขอจองห้อง')}
              className="whitespace-nowrap bg-indigo-50 text-indigo-900 hover:bg-indigo-100 px-2.5 py-1 rounded-full border border-indigo-200"
            >
              🏢 จองห้องประชุม
            </button>
            <button
              onClick={() => handleSend('ขอจองรถ')}
              className="whitespace-nowrap bg-blue-50 text-blue-900 hover:bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200"
            >
              🚗 จองรถยนต์
            </button>
            <button
              onClick={() => handleSend('ประเภทรถ')}
              className="whitespace-nowrap bg-teal-50 text-teal-900 hover:bg-teal-100 px-2.5 py-1 rounded-full border border-teal-200"
            >
              🚘 ประเภทรถ
            </button>
            <button
              onClick={() => handleSend('รายการรถ')}
              className="whitespace-nowrap bg-sky-50 text-sky-900 hover:bg-sky-100 px-2.5 py-1 rounded-full border border-sky-200"
            >
              🚙 รายการรถ
            </button>
            <button
              onClick={() => handleSend('สถิติการใช้ห้อง')}
              className="whitespace-nowrap bg-amber-50 text-amber-900 hover:bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200"
            >
              📊 สถิติการใช้ห้อง
            </button>
            <button
              onClick={() => handleSend('สถิติไม่เข้าใช้งาน')}
              className="whitespace-nowrap bg-rose-50 text-rose-900 hover:bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200"
            >
              ⚠️ ไม่เข้าใช้งาน
            </button>
            <button
              onClick={() => handleSend('ข้อมูลห้อง')}
              className="whitespace-nowrap bg-blue-50 text-blue-900 hover:bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200 transition-colors"
            >
              🚪 ข้อมูลห้อง
            </button>
            <button
              onClick={() => handleSend('สถานที่')}
              className="whitespace-nowrap bg-emerald-50 text-emerald-900 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300 transition-colors"
            >
              📍 สถานที่/ชั้น
            </button>
          </div>

          {/* ช่องพิมพ์ข้อความ (Input Area) */}
          <div className="p-3 bg-white border-t border-gray-200 flex gap-2 items-center">
            <input
              type="text"
              className="flex-1 border border-gray-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent bg-gray-50"
              placeholder="พิมพ์ชื่อห้อง, วันที่ หรือผู้จอง..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-blue-900 hover:bg-blue-800 disabled:bg-gray-300 text-white p-2.5 rounded-xl shadow transition-all flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}
    </div>
  );
}