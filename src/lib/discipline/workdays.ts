// حساب أيام العمل وفق تقويم المدرسة (عطلة نهاية الأسبوع + العطل المسجلة)

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export type Calendar = { weekend: number[]; holidays: Set<string> };

export function isWorkday(d: Date, cal: Calendar): boolean {
  return !cal.weekend.includes(d.getDay()) && !cal.holidays.has(ymd(d));
}

/** تاريخ آخر يوم ضمن المدة: يضيف n أيام عمل بعد التاريخ المعطى (اليوم نفسه لا يُحسب). */
export function addWorkdays(start: string, n: number, cal: Calendar): string {
  const d = parse(start);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (isWorkday(d, cal)) left--;
  }
  return ymd(d);
}

/** عدد أيام العمل المنقضية بين تاريخين (البداية مستبعدة، النهاية مشمولة). */
export function workdaysBetween(from: string, to: string, cal: Calendar): number {
  const a = parse(from);
  const b = parse(to);
  let n = 0;
  const step = a <= b ? 1 : -1;
  const d = new Date(a);
  while (ymd(d) !== ymd(b)) {
    d.setDate(d.getDate() + step);
    if (isWorkday(d, cal)) n += step;
  }
  return n;
}

export type DeadlineState = 'ok' | 'due-soon' | 'overdue';

export function deadlineState(dueDate: string, today: string, cal: Calendar): DeadlineState {
  if (today > dueDate) return 'overdue';
  return workdaysBetween(today, dueDate, cal) <= 1 ? 'due-soon' : 'ok';
}
