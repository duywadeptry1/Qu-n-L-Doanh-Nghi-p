// Date helpers pinned to the business time zone (Vietnam), independent of the host machine's TZ.
const TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Ho_Chi_Minh';

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

/** Returns { year, month (1-12), day, hour, minute } of `date` in TIME_ZONE. */
function getZonedParts(date = new Date()) {
  const parts = {};
  for (const { type, value } of partsFormatter.formatToParts(date)) {
    if (type !== 'literal') parts[type] = parseInt(value, 10);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute
  };
}

const pad2 = n => String(n).padStart(2, '0');

/** "dd/MM/yyyy" in TIME_ZONE */
function formatDateLabel(date = new Date()) {
  const { year, month, day } = getZonedParts(date);
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

/** "dd/MM/yyyy • HH:mm" in TIME_ZONE (used as Order.timeAgo) */
function formatOrderTimeLabel(date = new Date()) {
  const { year, month, day, hour, minute } = getZonedParts(date);
  return `${pad2(day)}/${pad2(month)}/${year} • ${pad2(hour)}:${pad2(minute)}`;
}

/** Number of days in a 1-based month */
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

module.exports = {
  TIME_ZONE,
  pad2,
  getZonedParts,
  formatDateLabel,
  formatOrderTimeLabel,
  daysInMonth
};
