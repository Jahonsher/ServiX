/**
 * Ikki nuqta orasidagi masofani metrda hisoblash (Haversine formula)
 */
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Oylik ish kunlarini hisoblash (dam kunini hisobga olgan holda)
 */
function calcWorkingDays(yearMonth, weeklyOff) {
  const [y, m] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dayNames = [
    "sunday", "monday", "tuesday", "wednesday",
    "thursday", "friday", "saturday",
  ];
  let workDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dayNames[dow] !== (weeklyOff || "sunday")) workDays++;
  }
  return workDays;
}

/**
 * Vaqtni "HH:MM" formatga o'girish (minutlardan)
 */
function minutesToTimeStr(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * "HH:MM" formatni minutlarga o'girish
 */
function timeStrToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

module.exports = {
  getDistance,
  calcWorkingDays,
  minutesToTimeStr,
  timeStrToMinutes,
};