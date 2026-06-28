const CHINESE_NUMBERS = new Map([
  ['零', 0],
  ['一', 1],
  ['二', 2],
  ['两', 2],
  ['三', 3],
  ['四', 4],
  ['五', 5],
  ['六', 6],
  ['七', 7],
  ['八', 8],
  ['九', 9],
  ['十', 10],
]);

export function extractIsoDate(value) {
  const text = String(value || '');
  const match = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return formatDateParts(year, month, day);
}

export function addDays(isoDate, offset) {
  if (!isoDate || !Number.isFinite(Number(offset))) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(offset));
  return formatDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function dateRangeAround(isoDate, days = 0) {
  const offset = Math.max(0, Math.floor(Number(days) || 0));
  return [addDays(isoDate, -offset), addDays(isoDate, offset)];
}

export function normalizeDateRange(range) {
  if (!Array.isArray(range) || range.length < 2) return null;
  const start = extractIsoDate(range[0]);
  const end = extractIsoDate(range[1]);
  if (!start || !end) return null;
  return start <= end ? [start, end] : [end, start];
}

export function resolveRelativeDate(userMessage, baseDate) {
  const text = String(userMessage || '');
  if (!baseDate) return null;
  if (/今天/.test(text)) return { date: baseDate, offset: 0, label: 'today' };
  if (/明天/.test(text)) return { date: addDays(baseDate, 1), offset: 1, label: 'tomorrow' };
  if (/后天/.test(text)) return { date: addDays(baseDate, 2), offset: 2, label: 'day_after_tomorrow' };
  if (/昨天/.test(text)) return { date: addDays(baseDate, -1), offset: -1, label: 'yesterday' };

  const dayMatch = text.match(/([0-9]+|[一二两三四五六七八九十])\s*天后/);
  if (dayMatch) {
    const days = parseSmallNumber(dayMatch[1]);
    if (days !== null) return { date: addDays(baseDate, days), offset: days, label: 'days_after' };
  }

  const weekMatch = text.match(/([0-9]+|[一二两三四五六七八九十])?\s*周后/);
  if (weekMatch) {
    const weeks = parseSmallNumber(weekMatch[1] || '一');
    if (weeks !== null) return { date: addDays(baseDate, weeks * 7), offset: weeks * 7, label: 'weeks_after' };
  }

  if (/下周/.test(text)) {
    return { date: addDays(baseDate, 7), offset: 7, label: 'next_week' };
  }

  return null;
}

export function parseSmallNumber(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  if (CHINESE_NUMBERS.has(text)) return CHINESE_NUMBERS.get(text);
  if (text.startsWith('十')) {
    const tail = text.slice(1);
    return 10 + (CHINESE_NUMBERS.get(tail) || 0);
  }
  if (text.includes('十')) {
    const [head, tail] = text.split('十');
    const tens = CHINESE_NUMBERS.get(head) || 1;
    return tens * 10 + (CHINESE_NUMBERS.get(tail) || 0);
  }
  return null;
}

function formatDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

