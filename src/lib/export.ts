import * as XLSX from 'xlsx';
import type { AttendanceRow, AttendanceWithStudent } from './types';
import { formatArabicDateShort, formatArabicDayName, ARABIC_DAYS } from './types';

// تصدير البيانات إلى ملف إكسل
export function exportToExcel(
  rows: Record<string, string | number>[],
  sheetName: string,
  fileName: string
): void {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  // تعيين اتجاه الورقة من اليمين إلى اليسار
  if (!worksheet['!cols']) {
    worksheet['!cols'] = [];
  }
  const workbook = XLSX.utils.book_new();
  if (workbook.Workbook) {
    workbook.Workbook.Views = [{ RTL: true }];
  } else {
    workbook.Workbook = { Views: [{ RTL: true }] };
  }
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

// استيراد ملف إكسل
export function importFromExcel(
  file: File
): Promise<{ names: string[]; headers: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
        const headers = jsonRows.length > 0 ? Object.keys(jsonRows[0]) : [];
        const names = jsonRows
          .map((row) => {
            const val = headers.length > 0 ? row[headers[0]] : '';
            return String(val || '').trim();
          })
          .filter((n) => n.length > 0);
        resolve({ names, headers });
      } catch {
        reject(new Error('فشل في قراءة الملف. تأكد من أنه ملف إكسل صالح.'));
      }
    };
    reader.onerror = () => reject(new Error('فشل في قراءة الملف.'));
    reader.readAsArrayBuffer(file);
  });
}

// تصدير سجل الحضور اليومي إلى إكسل
export function exportDailyAttendanceToExcel(
  className: string,
  date: string,
  records: AttendanceWithStudent[]
): void {
  const rows = records.map((r, idx) => ({
    'الرقم': idx + 1,
    'الاسم': r.student_name || '',
    'الصف': r.class_name || className,
    'الحالة': r.status,
    'ملاحظات': r.note || '',
  }));
  exportToExcel(rows, 'الحضور اليومي', `تقرير_يومي_${className}_${date}`);
}

// تصدير التقرير الشهري إلى إكسل
export function exportMonthlyReportToExcel(
  className: string,
  monthName: string,
  students: { name: string; absences: { date: string; status: string; note?: string }[] }[]
): void {
  const rows = students.map((s, idx) => {
    const excused = s.absences.filter((a) => a.status === 'غائب بعذر').length;
    const unexcused = s.absences.filter((a) => a.status === 'غائب بلا عذر').length;
    const total = excused + unexcused;
    return {
      'الرقم': idx + 1,
      'اسم الطالب': s.name,
      'غائب بعذر': excused,
      'غائب بلا عذر': unexcused,
      'إجمالي الغياب': total,
      'أيام الغياب': s.absences.map((a) => formatArabicDateShort(a.date)).join('، '),
    };
  });
  exportToExcel(rows, 'التقرير الشهري', `تقرير_شهري_${className}_${monthName}`);
}

// تصدير سجل الطالب إلى إكسل
export function exportStudentReportToExcel(
  studentName: string,
  className: string,
  records: AttendanceRow[]
): void {
  const rows: Record<string, string | number>[] = records.map((r, idx) => ({
    'الرقم': idx + 1,
    'التاريخ': formatArabicDateShort(r.date),
    'اليوم': formatArabicDayName(r.date),
    'الحالة': r.status,
    'ملاحظات': r.note || '',
  }));
  const present = records.filter((r) => r.status === 'حاضر').length;
  const excused = records.filter((r) => r.status === 'غائب بعذر').length;
  const unexcused = records.filter((r) => r.status === 'غائب بلا عذر').length;

  // إضافة صف الملخص
  rows.push(
    { 'الرقم': '', 'التاريخ': 'الملخص', 'اليوم': '', 'الحالة': '', 'ملاحظات': '' },
    { 'الرقم': '', 'التاريخ': 'إجمالي الأيام المسجلة', 'اليوم': String(records.length), 'الحالة': '', 'ملاحظات': '' },
    { 'الرقم': '', 'التاريخ': 'حاضر', 'اليوم': String(present), 'الحالة': '', 'ملاحظات': '' },
    { 'الرقم': '', 'التاريخ': 'غائب بعذر', 'اليوم': String(excused), 'الحالة': '', 'ملاحظات': '' },
    { 'الرقم': '', 'التاريخ': 'غائب بلا عذر', 'اليوم': String(unexcused), 'الحالة': '', 'ملاحظات': '' },
  );
  exportToExcel(rows, 'سجل الطالب', `سجل_${studentName}`);
}

// تصدير التقرير اليومي الشامل لجميع الصفوف إلى إكسل
export function exportAllClassesDailyToExcel(
  date: string,
  classReports: { className: string; records: AttendanceWithStudent[] }[]
): void {
  const rows: Record<string, string | number>[] = [];
  let idx = 1;
  for (const cls of classReports) {
    for (const r of cls.records) {
      rows.push({
        'الرقم': idx++,
        'الصف': cls.className,
        'الاسم': r.student_name || '',
        'الحالة': r.status,
        'ملاحظات': r.note || '',
      });
    }
  }
  exportToExcel(rows, 'التقرير الشامل', `تقرير_يومي_شامل_${date}`);
}

// مشاركة عبر واتساب
export function shareViaWhatsApp(text: string): void {
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

// توليد نص التقرير اليومي للمشاركة
export function generateDailyReportText(
  className: string,
  date: string,
  records: AttendanceWithStudent[]
): string {
  const present = records.filter((r) => r.status === 'حاضر').length;
  const excused = records.filter((r) => r.status === 'غائب بعذر').length;
  const unexcused = records.filter((r) => r.status === 'غائب بلا عذر').length;
  const total = records.length;

  let text = `📋 *تقرير الحضور والغياب*\n`;
  text += `🏫 مدرسة أحمد الفاتح الإعدادية للبنين\n`;
  text += `📅 ${formatArabicDateShort(date)} - ${formatArabicDayName(date)}\n`;
  text += `🏫 الصف: ${className}\n`;
  text += `─────────────────\n`;
  text += `✅ حاضر: ${present} (${total > 0 ? Math.round((present / total) * 100) : 0}%)\n`;
  text += `⚠️ غائب بعذر: ${excused}\n`;
  text += `❌ غائب بلا عذر: ${unexcused}\n`;
  text += `─────────────────\n`;
  text += `📊 الإجمالي: ${total} طالب\n\n`;

  if (excused + unexcused > 0) {
    text += `*قائمة الغائبين:*\n`;
    records
      .filter((r) => r.status !== 'حاضر')
      .forEach((r) => {
        const icon = r.status === 'غائب بعذر' ? '⚠️' : '❌';
        text += `${icon} ${r.student_name} - ${r.status}`;
        if (r.note) text += ` (${r.note})`;
        text += `\n`;
      });
  }
  return text;
}

// توليد نص التقرير الشامل اليومي
export function generateAllClassesDailyText(
  date: string,
  classReports: { className: string; records: AttendanceWithStudent[] }[]
): string {
  let text = `📋 *التقرير اليومي الشامل*\n`;
  text += `🏫 مدرسة أحمد الفاتح الإعدادية للبنين\n`;
  text += `📅 ${formatArabicDateShort(date)} - ${formatArabicDayName(date)}\n`;
  text += `═════════════════\n`;

  let totalPresent = 0;
  let totalExcused = 0;
  let totalUnexcused = 0;
  let totalStudents = 0;

  for (const cls of classReports) {
    const present = cls.records.filter((r) => r.status === 'حاضر').length;
    const excused = cls.records.filter((r) => r.status === 'غائب بعذر').length;
    const unexcused = cls.records.filter((r) => r.status === 'غائب بلا عذر').length;
    const total = cls.records.length;

    totalPresent += present;
    totalExcused += excused;
    totalUnexcused += unexcused;
    totalStudents += total;

    text += `\n🏫 *${cls.className}* (${total} طالب)\n`;
    text += `✅ حاضر: ${present} | ⚠️ بعذر: ${excused} | ❌ بلا عذر: ${unexcused}\n`;
    if (excused + unexcused > 0) {
      cls.records
        .filter((r) => r.status !== 'حاضر')
        .forEach((r) => {
          const icon = r.status === 'غائب بعذر' ? '⚠️' : '❌';
          text += `  ${icon} ${r.student_name}\n`;
        });
    }
  }

  text += `\n═════════════════\n`;
  text += `📊 *الإجمالي العام:*\n`;
  text += `✅ حاضر: ${totalPresent} | ⚠️ بعذر: ${totalExcused} | ❌ بلا عذر: ${totalUnexcused}\n`;
  text += `📊 إجمالي الطلاب: ${totalStudents}`;
  return text;
}

// نسخ احتياطي للبيانات
export async function generateBackup(): Promise<string> {
  // سيتم استدعاؤها مع بيانات محددة من المكون
  return '';
}

// تنزيل ملف
export function downloadFile(content: string, fileName: string, mimeType: string = 'application/json'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getDayName(date: Date): string {
  return ARABIC_DAYS[date.getDay()];
}
