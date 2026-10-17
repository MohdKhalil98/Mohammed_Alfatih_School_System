import { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useDiscipline } from '@/lib/discipline/data';
import { can } from '@/lib/discipline/constants';
import type { SchoolSettings } from '@/lib/discipline/types';
import { Badge, Field, Notice, PageTitle, dbError, fmtDate } from '@/components/discipline/ui';
import type { PageProps } from './props';
import ClassesManager from './ClassesManager';
import UsersManager from './UsersManager';

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

type AuditRow = { id: number; at: string; user_name: string | null; actor_role: string | null; operation: string; table_name: string | null; details: string | null };

export default function SettingsPage({ role }: PageProps) {
  const { show } = useToast();
  const { settings, holidays, reload } = useDiscipline();
  const [s, setS] = useState<SchoolSettings>(settings);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [holiday, setHoliday] = useState('');
  const editable = can.settings(role);

  const loadAdmin = useCallback(async () => {
    if (can.audit(role)) {
      const a = await supabase.from('audit_log').select('id,at,user_name,actor_role,operation,table_name,details').order('at', { ascending: false }).limit(50);
      setAudit((a.data ?? []) as AuditRow[]);
    }
  }, [role]);
  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const field = (k: keyof SchoolSettings, label: string, type = 'text') => (
    <Field label={label}>
      <input
        type={type}
        className="input-field"
        disabled={!editable}
        value={(s[k] as string | number | null) ?? ''}
        onChange={(e) => setS({ ...s, [k]: type === 'number' ? Number(e.target.value) : e.target.value || null })}
      />
    </Field>
  );

  async function saveSettings() {
    const { id: _id, ...rest } = s as SchoolSettings & { id?: number };
    void _id;
    const { error } = await supabase.from('school_settings').update(rest).eq('id', 1);
    if (error) return show(dbError(error), 'error');
    show('تم حفظ الإعدادات', 'success');
    reload();
  }

  async function addHoliday() {
    if (!holiday) return;
    const { error } = await supabase.from('holidays').insert({ holiday_date: holiday });
    if (error) return show(dbError(error), 'error');
    setHoliday('');
    reload();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 fade-in space-y-5">
      <PageTitle icon={<Settings className="w-6 h-6" />} title="إعدادات الانضباط والصلاحيات" />
      {!editable && <Notice tone="blue">التعديل متاح لمدير النظام فقط.</Notice>}

      <section className="card space-y-3">
        <h2 className="font-bold">بيانات المدرسة والطباعة</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {field('country', 'الدولة')}
          {field('authority', 'الجهة')}
          {field('school_name', 'اسم المدرسة')}
          {field('academic_year', 'العام الدراسي')}
          {field('term', 'الفصل الدراسي')}
          {field('principal_name', 'مدير المدرسة')}
          {field('officer_name', 'المسؤول المختص')}
          {field('print_header_note', 'سطر إضافي في الترويسة')}
          {field('school_logo_url', 'رابط شعار المدرسة (عند توفره)')}
          {field('ministry_logo_url', 'رابط شعار الوزارة (عند توفر الملف الرسمي)')}
        </div>
        <h3 className="font-semibold pt-2">المدد النظامية (أيام عمل)</h3>
        <Notice>أُدخلت القيم الافتراضية من ملخص اللائحة (المواد 11–13 و20) ولم تُطابق مع النص الرسمي. راجعها ثم فعّل الخيار أدناه.</Notice>
        <div className="grid sm:grid-cols-3 gap-3">
          {field('committee_recommendation_days', 'رفع توصية اللجنة', 'number')}
          {field('guardian_notice_days', 'إخطار ولي الأمر بالقرار', 'number')}
          {field('appeal_days', 'تقديم التظلم', 'number')}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={!editable} checked={s.periods_verified} onChange={(e) => setS({ ...s, periods_verified: e.target.checked })} />
          طابقتُ المدد مع نص اللائحة الرسمي
        </label>
        <div>
          <p className="text-sm font-semibold mb-1">عطلة نهاية الأسبوع</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  disabled={!editable}
                  checked={s.weekend_days.includes(i)}
                  onChange={() => setS({ ...s, weekend_days: s.weekend_days.includes(i) ? s.weekend_days.filter((x) => x !== i) : [...s.weekend_days, i] })}
                />
                {d}
              </label>
            ))}
          </div>
        </div>
        {editable && <button className="btn-primary" onClick={saveSettings}>حفظ الإعدادات</button>}
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">العطل الرسمية (تُستثنى من أيام العمل)</h2>
        <div className="flex flex-wrap gap-2">
          {holidays.sort().map((h) => <Badge key={h}>{fmtDate(h)}</Badge>)}
          {holidays.length === 0 && <span className="text-sm text-gray-500">لا توجد عطل مسجلة.</span>}
        </div>
        {editable && (
          <div className="flex gap-2">
            <input type="date" className="input-field !w-auto" value={holiday} onChange={(e) => setHoliday(e.target.value)} />
            <button className="btn-secondary" onClick={addHoliday}>إضافة عطلة</button>
          </div>
        )}
      </section>

      <ClassesManager editable={editable} />

      {can.admin(role) && <UsersManager />}

      {can.audit(role) && (
        <section className="card">
          <h2 className="font-bold mb-2">سجل التدقيق (آخر 50 عملية)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-600"><tr><th className="p-1 text-right">الوقت</th><th className="p-1 text-right">المستخدم</th><th className="p-1 text-right">الدور</th><th className="p-1 text-right">العملية</th><th className="p-1 text-right">الجدول</th><th className="p-1 text-right">تفاصيل</th></tr></thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="p-1 whitespace-nowrap">{new Date(a.at).toLocaleString('ar-BH-u-nu-latn')}</td>
                    <td className="p-1">{a.user_name ?? '—'}</td>
                    <td className="p-1">{a.actor_role ?? '—'}</td>
                    <td className="p-1">{a.operation}</td>
                    <td className="p-1">{a.table_name ?? '—'}</td>
                    <td className="p-1">{a.details ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
