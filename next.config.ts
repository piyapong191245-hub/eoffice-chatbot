import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.170.112.47'],
  
  // ปิด Error ของ Turbopack เมื่อมีไฟล์ config พิเศษ
  turbopack: {},
  
};

export default nextConfig;