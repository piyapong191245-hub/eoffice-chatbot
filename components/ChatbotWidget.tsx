'use client';
import ReactMarkdown from 'react-markdown';
import { useState, useRef, useEffect } from 'react';
import { X, Send, RotateCcw, Building2, Car, Minus, ChevronUp, ChevronLeft, ChevronRight, QrCode, ExternalLink, Layers } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string; qrUrl?: string; itemType?: 'room' | 'car' }[]>([
    {
      sender: 'bot',
      text: 'สวัสดีครับ ผมคือผู้ช่วยระบบ **e-Office (สำนักงาน ป.ป.ท.)**\n\nสามารถสอบถามข้อมูลการจอง **ห้องประชุม** หรือ **รถยนต์ส่วนกลาง** ได้เลยครับ'
    }
  ]);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen, isMinimized]);

  const scrollQuickReply = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.6;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth',
      });
    }
  };

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

      const qrUrl = data.carUrl || data.roomUrl;
      const itemType = data.carUrl ? 'car' : data.roomUrl ? 'room' : undefined;

      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: data.reply,
          qrUrl: qrUrl,
          itemType: itemType
        }
      ]);

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
      { sender: 'bot', text: 'สวัสดีครับ ผมคือผู้ช่วยระบบ **e-Office (สำนักงาน ป.ป.ท.)**\n\nสามารถสอบถามข้อมูลการจอง **ห้องประชุม** หรือ **รถยนต์ส่วนกลาง** ได้เลยครับ' }
    ]);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setIsMinimized(false); }}
          className="bg-blue-900 hover:bg-blue-800 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 transition-all transform hover:scale-105 border-2 border-amber-400 cursor-pointer"
        >
          <Layers className="w-6 h-6 text-amber-400" />
          <span className="font-medium text-sm hidden sm:inline">สอบถามการจองห้องประชุม/รถยนต์</span>
        </button>
      )}

      {isOpen && (
        <div className={`w-87.5 sm:w-97.5 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 ${isMinimized ? 'h-14' : 'h-130'}`}>

          {/* Header */}
          <div className="bg-linear-to-r from-blue-950 via-blue-900 to-blue-800 text-white p-3.5 flex justify-between items-center shadow-md select-none">
            <div
              className="flex items-center gap-2.5 cursor-pointer flex-1"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <div className="bg-amber-400 p-1.5 rounded-lg text-blue-950 flex gap-1 items-center">
                <Building2 className="w-4 h-4" />
                <Car className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide text-amber-300">PACC e-Office Assistant</h3>
                <p className="text-[11px] text-blue-200">ระบบสอบถามการจองห้องประชุม & รถยนต์</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "ขยายหน้าต่าง" : "ย่อหน้าต่าง"}
                className="p-1.5 hover:bg-blue-800 rounded-lg text-blue-200 hover:text-white transition-colors cursor-pointer"
              >
                {isMinimized ? <ChevronUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              </button>
              <button
                onClick={clearChat}
                title="ล้างประวัติการคุย"
                className="p-1.5 hover:bg-blue-800 rounded-lg text-blue-200 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="ปิด"
                className="p-1.5 hover:bg-blue-800 rounded-lg text-blue-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50 text-xs sm:text-sm">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl max-w-[88%] shadow-sm ${msg.sender === 'user'
                        ? 'bg-blue-900 text-white ml-auto rounded-tr-none'
                        : 'bg-white text-gray-800 mr-auto border border-gray-100 rounded-tl-none'
                      }`}
                  >
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed text-xs sm:text-sm">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-amber-600 dark:text-amber-400">{children}</strong>,
                        img: ({ node, ...props }) => (
                          <img
                            {...props}
                            style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', margin: '8px 0', display: 'block' }}
                            alt={props.alt || 'image'}
                          />
                        ),
                        h3: ({ children }) => <h3 className="font-bold text-sm text-blue-950 my-1">{children}</h3>,
                        hr: () => <hr className="my-2 border-gray-200" />
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>

                    {/* การ์ดแสดง QR Code */}
                    {msg.sender === 'bot' && msg.qrUrl && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-gray-200 flex flex-col items-center gap-2">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-950">
                          <QrCode className="w-3.5 h-3.5 text-amber-500" />
                          <span>
                            {msg.itemType === 'car'
                              ? 'สแกน QR Code เพื่อเปิดหน้ารายละเอียดรถคันนี้'
                              : 'สแกน QR Code เพื่อเปิดหน้าห้องประชุมนี้'}
                          </span>
                        </div>

                        <div className="p-2 bg-white rounded-lg shadow-xs border border-gray-100">
                          <QRCodeSVG value={msg.qrUrl} size={115} />
                        </div>

                        <a
                          href={msg.qrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 font-medium hover:underline"
                        >
                          {msg.itemType === 'car' ? 'เปิดไปยังหน้ารายละเอียดรถ' : 'เปิดไปยังหน้าห้องประชุม'} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}

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

              {/* Quick Reply Bar */}
              <div className="bg-white border-t border-gray-100 p-2">
                <div className="relative flex items-center gap-1">
                  <button
                    onClick={() => scrollQuickReply('left')}
                    className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors shrink-0 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div
                    ref={scrollRef}
                    className="flex gap-1.5 overflow-x-auto scroll-smooth whitespace-nowrap py-1 px-0.5 flex-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  >
                    <button
                      onClick={() => handleSend('ขอจองห้อง')}
                      className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 px-2.5 py-1 rounded-full border border-indigo-200 text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      🏢 จองห้องประชุม
                    </button>

                    <button
                      onClick={() => handleSend('ขอจองรถ')}
                      className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 hover:bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200 text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      🚗 จองรถยนต์
                    </button>

                    <button
                      onClick={() => handleSend('ประเภทรถ')}
                      className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 hover:bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300 text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      🚘 ประเภทรถ
                    </button>

                    <button
                      onClick={() => handleSend('รายการรถ')}
                      className="inline-flex items-center gap-1 bg-sky-50 text-sky-900 hover:bg-sky-100 px-2.5 py-1 rounded-full border border-sky-200 text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      🚙 รายการรถทั้งหมด
                    </button>

                    <button
                      onClick={() => handleSend('ข้อมูลห้อง')}
                      className="inline-flex items-center gap-1 bg-purple-50 text-purple-900 hover:bg-purple-100 px-2.5 py-1 rounded-full border border-purple-200 text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      🚪 ข้อมูลห้อง
                    </button>

                    <button
                      onClick={() => handleSend('สถานที่')}
                      className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300 text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      📍 สถานที่/ชั้น
                    </button>

                    <button
                      onClick={() => handleSend('สถิติ')}
                      className="inline-flex items-center gap-1 bg-rose-50 text-rose-900 hover:bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200 text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      📊 รายงานสถิติ
                    </button>
                  </div>

                  <button
                    onClick={() => scrollQuickReply('right')}
                    className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors shrink-0 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-gray-200 flex gap-2 items-center">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent bg-gray-50"
                  placeholder="พิมพ์ชื่อห้อง หรือ เลขทะเบียนรถ..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className="bg-blue-900 hover:bg-blue-800 disabled:bg-gray-300 text-white p-2.5 rounded-xl shadow transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}