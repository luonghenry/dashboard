// Simple lunar calendar implementation
// This is a simplified implementation and may not be 100% accurate.
// For more accurate calculations, consider using a well-tested library.

const LUNAR_MONTH_DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const CAN = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
const CHI = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];

function isLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function getDaysInMonth(year, month) {
  if (month === 2) {
    return isLeap(year) ? 29 : 28;
  }
  return LUNAR_MONTH_DAYS[month];
}

// A simple approximation for lunar date.
// This is not a correct implementation of a lunisolar calendar.
export function getLunarDate(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // This is a very rough approximation and not a real lunar calendar.
  let lunarDay = day - 10;
  let lunarMonth = month;
  if (lunarDay <= 0) {
    lunarMonth--;
    if (lunarMonth === 0) {
        lunarMonth = 12;
    }
    lunarDay += getDaysInMonth(year, lunarMonth);
  }


  const canChiYear = CAN[year % 10] + ' ' + CHI[year % 12];

  return {
    day: lunarDay,
    month: lunarMonth,
    year: year,
    yearCanChi: canChiYear,
    holiday: '' // Placeholder for holidays
  };
}
