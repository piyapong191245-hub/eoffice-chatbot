(function () {
  // ป้องกันการสร้างปุ่มซ้ำ
  if (document.getElementById('pacc-chatbot-container')) return;

  // สร้าง Container สำหรับวางแชทบอท
  const container = document.createElement('div');
  container.id = 'pacc-chatbot-container';
  container.style.position = 'fixed';
  container.style.bottom = '10px';
  container.style.right = '10px';
  container.style.zIndex = '999999';

  // ดึงหน้าแชทบอทจาก Vercel มาแสดงผลผ่าน iFrame
  const iframe = document.createElement('iframe');
  iframe.src = 'https://eoffice-chatbot-app.vercel.app';
  iframe.style.width = '380px';
  iframe.style.height = '600px';
  iframe.style.border = 'none';
  iframe.style.background = 'transparent';
  iframe.allow = 'microphone; camera';

  container.appendChild(iframe);
  document.body.appendChild(container);
})();