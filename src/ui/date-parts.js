// Year/month/day date picker shared by the ledger forms and the reference tab,
// replacing the calendar <input type=date>. Pure parts helpers plus a form
// control that serialises to YYYY-MM-DD through a hidden named input (so
// FormData / renderRecordForm reads it like an ordinary field).

import { h } from './dom.js';

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function range(start, end) {
  const out = [];
  for (let value = start; value <= end; value += 1) out.push(value);
  return out;
}

export function parseDateParts(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match
    ? { y: String(Number(match[1])), mo: String(Number(match[2])), d: String(Number(match[3])) }
    : { y: '', mo: '', d: '' };
}

export function partsToIso(parts) {
  const y = Number(parts.y);
  const mo = Number(parts.mo);
  const d = Number(parts.d);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return '';
  return `${y}-${pad2(mo)}-${pad2(Math.min(d, daysInMonth(y, mo)))}`;
}

export function clampIso(date, min, max) {
  if (!date) return date;
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
}

function dateOption(value, label, current) {
  const option = h('option', { value, text: label });
  option.selected = String(value) === String(current ?? '');
  return option;
}

export function dateSelect(name, value = '', { minYear = 1990, maxYear = 2040 } = {}) {
  const parts = parseDateParts(value);
  const hidden = h('input', { type: 'hidden', name, value: partsToIso(parts) });
  const ySel = h('select');
  const moSel = h('select');
  const dSel = h('select');

  const fillDays = (desired) => {
    const y = Number(ySel.value);
    const mo = Number(moSel.value);
    const max = (Number.isInteger(y) && Number.isInteger(mo)) ? daysInMonth(y, mo) : 31;
    const wantNum = Number(desired ?? dSel.value);
    const keep = Number.isInteger(wantNum) && wantNum >= 1 ? String(Math.min(wantNum, max)) : '';
    dSel.replaceChildren(dateOption('', '日', keep), ...range(1, max).map((v) => dateOption(String(v), `${v}日`, keep)));
  };
  const recompose = () => {
    hidden.value = partsToIso({ y: ySel.value, mo: moSel.value, d: dSel.value });
  };

  ySel.replaceChildren(dateOption('', '年', parts.y), ...range(minYear, maxYear).map((v) => dateOption(String(v), `${v}`, parts.y)));
  moSel.replaceChildren(dateOption('', '月', parts.mo), ...range(1, 12).map((v) => dateOption(String(v), `${v}月`, parts.mo)));
  fillDays(parts.d);

  ySel.addEventListener('change', () => { fillDays(); recompose(); });
  moSel.addEventListener('change', () => { fillDays(); recompose(); });
  dSel.addEventListener('change', recompose);

  return h('div', { class: 'fcl-date-row' }, [ySel, moSel, dSel, hidden]);
}
