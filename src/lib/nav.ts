import {
  Home, BookOpen, Users, ClipboardCheck, FileText, CalendarDays, User, Database,
  LayoutDashboard, FilePlus2, ListChecks, Search, FolderOpen, Gavel, PhoneCall,
  Scale, Printer, BarChart3, Library, Settings,
} from 'lucide-react';

export type PageKey =
  | 'home'
  | 'classes'
  | 'students'
  | 'attendance'
  | 'daily-report'
  | 'monthly-report'
  | 'student-record'
  | 'backup'
  | 'd-dashboard'
  | 'd-new'
  | 'd-incidents'
  | 'd-search'
  | 'd-student'
  | 'd-actions'
  | 'd-summons'
  | 'd-committee'
  | 'd-forms'
  | 'd-reports'
  | 'd-catalog'
  | 'd-settings';

export type NavItem = {
  key: PageKey;
  label: string;
  icon: typeof Home;
};

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'الصفحة الرئيسية', icon: Home },
  { key: 'classes', label: 'إدارة الصفوف', icon: BookOpen },
  { key: 'students', label: 'إدارة الطلاب', icon: Users },
  { key: 'attendance', label: 'تسجيل الحضور والغياب', icon: ClipboardCheck },
  { key: 'daily-report', label: 'التقرير اليومي', icon: FileText },
  { key: 'monthly-report', label: 'التقرير الشهري', icon: CalendarDays },
  { key: 'student-record', label: 'سجل الطالب', icon: User },
  { key: 'backup', label: 'حفظ البيانات', icon: Database },
];

// قسم الانضباط الطلابي
export const DISCIPLINE_ITEMS: NavItem[] = [
  { key: 'd-dashboard', label: 'لوحة متابعة المخالفات', icon: LayoutDashboard },
  { key: 'd-new', label: 'تسجيل مخالفة جديدة', icon: FilePlus2 },
  { key: 'd-incidents', label: 'سجل جميع المخالفات', icon: ListChecks },
  { key: 'd-search', label: 'البحث عن طالب', icon: Search },
  { key: 'd-student', label: 'ملف الطالب السلوكي', icon: FolderOpen },
  { key: 'd-actions', label: 'الإجراءات والتعهدات', icon: Gavel },
  { key: 'd-summons', label: 'استدعاءات أولياء الأمور', icon: PhoneCall },
  { key: 'd-committee', label: 'لجنة الانضباط والتحقيقات', icon: Scale },
  { key: 'd-forms', label: 'النماذج والمستندات', icon: Printer },
  { key: 'd-reports', label: 'التقارير والإحصاءات', icon: BarChart3 },
  { key: 'd-catalog', label: 'قاعدة المخالفات الرسمية', icon: Library },
  { key: 'd-settings', label: 'إعدادات الانضباط والصلاحيات', icon: Settings },
];

export function isDisciplinePage(key: PageKey): boolean {
  return key.startsWith('d-');
}
