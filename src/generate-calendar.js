import { getLunarDate } from 'dashboard';
import fs from 'fs';
import path from 'path';

// Tính toán lịch âm cho ngày hôm nay
const today = new Date();
const lunar = getLunarDate(today);

// Tính toán cho tháng hiện tại (ví dụ: 30 ngày)
const monthData = [];
for (let i = 0; i < 30; i++) {
  const date = new Date();
  date.setDate(today.getDate() + i);
  const lunarDate = getLunarDate(date);
  
  monthData.push({
    solar: date.toLocaleDateString('vi-VN'),
    lunar: `${lunarDate.day}/${lunarDate.month}/${lunarDate.year}`,
    canChi: lunarDate.yearCanChi || '',
    holiday: lunarDate.holiday || ''
  });
}

// Đọc template HTML
const template = fs.readFileSync('src/template.html', 'utf-8');

// Generate bảng lịch
const tableRows = monthData.map(item => `
  <tr>
    <td>${item.solar}</td>
    <td>${item.lunar}</td>
    <td>${item.canChi}</td>
    <td>${item.holiday}</td>
  </tr>
`).join('');

// Replace placeholders trong template
const html = template
  .replace('{{TODAY_SOLAR}}', today.toLocaleDateString('vi-VN'))
  .replace('{{TODAY_LUNAR}}', `${lunar.day}/${lunar.month}/${lunar.year}`)
  .replace('{{YEAR_CANCHI}}', lunar.yearCanChi || '')
  .replace('{{TABLE_ROWS}}', tableRows)
  .replace('{{BUILD_TIME}}', new Date().toISOString());

// Tạo thư mục public nếu chưa có
if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

// Ghi file HTML ra thư mục public
fs.writeFileSync('public/index.html', html);

console.log('✅ Generated index.html successfully!');
console.log(`📅 Hôm nay: ${today.toLocaleDateString('vi-VN')} | Âm lịch: ${lunar.day}/${lunar.month}/${lunar.year}`);
