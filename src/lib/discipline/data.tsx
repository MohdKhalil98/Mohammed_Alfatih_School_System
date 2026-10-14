import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Calendar } from './workdays';
import type { Category, ClassX, SchoolSettings, StudentX, Violation } from './types';

// بيانات مرجعية تُحمَّل مرة واحدة لقسم الانضباط: الفئات، المخالفات، الصفوف، الطلاب، الإعدادات

export const DEFAULT_SETTINGS: SchoolSettings = {
  country: 'مملكة البحرين',
  authority: 'وزارة التربية والتعليم',
  school_name: 'مدرسة أحمد الفاتح الإعدادية للبنين',
  school_logo_url: null,
  ministry_logo_url: null,
  academic_year: null,
  term: null,
  principal_name: null,
  officer_name: null,
  print_header_note: null,
  weekend_days: [5, 6],
  committee_recommendation_days: 2,
  guardian_notice_days: 3,
  appeal_days: 7,
  periods_verified: false,
};

type DataValue = {
  ready: boolean;
  error: string | null;
  settings: SchoolSettings;
  categories: Category[];
  violations: Violation[]; // كل الإصدارات
  currentViolations: Violation[]; // غير المستبدلة
  classes: ClassX[];
  students: StudentX[];
  holidays: string[];
  calendar: Calendar;
  className: (id: string | null | undefined) => string;
  classOf: (id: string | null | undefined) => ClassX | undefined;
  studentOf: (id: string | null | undefined) => StudentX | undefined;
  violationOf: (id: string | null | undefined) => Violation | undefined;
  categoryOf: (id: number | null | undefined) => Category | undefined;
  reload: () => Promise<void>;
};

const Ctx = createContext<DataValue | null>(null);

export function DisciplineDataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [classes, setClasses] = useState<ClassX[]>([]);
  const [students, setStudents] = useState<StudentX[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const [s, c, v, cl, st, h] = await Promise.all([
      supabase.from('school_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('violation_categories').select('*').order('id'),
      supabase.from('violations_catalog').select('*').order('code'),
      supabase.from('classes').select('id,name,order_index,stage,grade_level').order('order_index'),
      supabase.from('students').select('id,name,class_id,school_number,guardian_name,guardian_phone').order('name'),
      supabase.from('holidays').select('holiday_date'),
    ]);
    const firstErr = [s, c, v, cl, st, h].find((r) => r.error)?.error;
    if (firstErr) {
      setError(
        /relation|column|does not exist|schema cache/i.test(firstErr.message)
          ? 'لم يتم تطبيق هجرات قاعدة بيانات الانضباط بعد (انظر docs/discipline-setup.md)'
          : 'تعذر تحميل بيانات الانضباط: ' + firstErr.message
      );
      setReady(true);
      return;
    }
    setError(null);
    if (s.data) setSettings({ ...DEFAULT_SETTINGS, ...(s.data as SchoolSettings) });
    setCategories((c.data ?? []) as Category[]);
    setViolations((v.data ?? []) as Violation[]);
    setClasses((cl.data ?? []) as ClassX[]);
    setStudents((st.data ?? []) as StudentX[]);
    setHolidays((h.data ?? []).map((r: { holiday_date: string }) => r.holiday_date));
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo<DataValue>(() => {
    const classMap = new Map(classes.map((x) => [x.id, x]));
    const studentMap = new Map(students.map((x) => [x.id, x]));
    const violationMap = new Map(violations.map((x) => [x.id, x]));
    const categoryMap = new Map(categories.map((x) => [x.id, x]));
    return {
      ready, error, settings, categories, violations,
      currentViolations: violations.filter((x) => x.status !== 'superseded'),
      classes, students, holidays,
      calendar: { weekend: settings.weekend_days, holidays: new Set(holidays) },
      className: (id) => (id ? classMap.get(id)?.name ?? '—' : '—'),
      classOf: (id) => (id ? classMap.get(id) : undefined),
      studentOf: (id) => (id ? studentMap.get(id) : undefined),
      violationOf: (id) => (id ? violationMap.get(id) : undefined),
      categoryOf: (id) => (id ? categoryMap.get(id) : undefined),
      reload,
    };
  }, [ready, error, settings, categories, violations, classes, students, holidays, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDiscipline() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDiscipline must be used within DisciplineDataProvider');
  return ctx;
}
