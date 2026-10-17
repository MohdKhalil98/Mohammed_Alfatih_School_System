export type ClassRow = {
  id: string;
  name: string;
  order_index: number;
  created_at?: string;
};

export type StudentRow = {
  id: string;
  name: string;
  class_id: string;
  created_at?: string;
};

export type AttendanceStatus = 'حاضر' | 'غائب بعذر' | 'غائب بلا عذر';

export type AttendanceRow = {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  note?: string | null;
  excuse_file_path?: string | null;
  created_at?: string;
};

export type StudentWithClass = StudentRow & {
  class_name?: string;
};

export type AttendanceWithStudent = AttendanceRow & {
  student_name?: string;
  class_name?: string;
};

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  'حاضر': 'حاضر',
  'غائب بعذر': 'غائب بعذر',
  'غائب بلا عذر': 'غائب بلا عذر',
};

export const STATUS_COLORS: Record<AttendanceStatus, { bg: string; text: string; border: string; dot: string }> = {
  'حاضر': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  'غائب بعذر': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500' },
  'غائب بلا عذر': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500' },
};

// أسماء الأشهر باللغة العربية
export const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

// أسماء أيام الأسبوع باللغة العربية
export const ARABIC_DAYS = [
  'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'
];

// تنسيق التاريخ باللغة العربية
export function formatArabicDate(date: Date): string {
  const dayName = ARABIC_DAYS[date.getDay()];
  const day = date.getDate();
  const monthName = ARABIC_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName} ${day} ${monthName} ${year}`;
}

export function formatArabicDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const monthName = ARABIC_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${monthName} ${year}`;
}

export function formatArabicDayName(dateStr: string): string {
  const date = new Date(dateStr);
  return ARABIC_DAYS[date.getDay()];
}

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMonthName(month: number): string {
  return ARABIC_MONTHS[month];
}
