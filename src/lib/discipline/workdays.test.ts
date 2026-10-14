import { describe, expect, it } from 'vitest';
import { addWorkdays, deadlineState, workdaysBetween } from './workdays';

// عطلة نهاية الأسبوع: الجمعة (5) والسبت (6)
const cal = { weekend: [5, 6], holidays: new Set<string>() };

describe('أيام العمل', () => {
  it('يتجاوز عطلة نهاية الأسبوع', () => {
    // الأربعاء 2026-10-14 + يومان = الأحد 2026-10-18
    expect(addWorkdays('2026-10-14', 2, cal)).toBe('2026-10-18');
  });

  it('يستثني العطل الرسمية', () => {
    const c = { weekend: [5, 6], holidays: new Set(['2026-10-15']) };
    // الخميس عطلة → الأحد ثم الاثنين
    expect(addWorkdays('2026-10-14', 2, c)).toBe('2026-10-19');
  });

  it('لا يستخدم الأيام التقويمية', () => {
    expect(addWorkdays('2026-10-14', 3, cal)).toBe('2026-10-19');
  });

  it('يحسب الأيام المنقضية ويحدد التأخر', () => {
    expect(workdaysBetween('2026-10-14', '2026-10-18', cal)).toBe(2);
    expect(deadlineState('2026-10-18', '2026-10-19', cal)).toBe('overdue');
    expect(deadlineState('2026-10-18', '2026-10-17', cal)).toBe('due-soon');
    expect(deadlineState('2026-10-25', '2026-10-14', cal)).toBe('ok');
  });
});
