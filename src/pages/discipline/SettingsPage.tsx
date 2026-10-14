import { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useDiscipline } from '@/lib/discipline/data';
import { ROLE_LABELS, STAGES, can } from '@/lib/discipline/constants';
import type { Profile, Role, SchoolSettings } from '@/lib/discipline/types';
import { Badge, Field, Notice, PageTitle, dbError, fmtDate } from '@/components/discipline/ui';
import type { PageProps } from './props';

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

type AuditRow = { id: number; at: string; user_name: string | null; actor_role: string | null; operation: string; table_name: string | null; details: string | null };

export default function SettingsPage({ role }: PageProps) {
  const { show } = useToast();
  const { settings, classes, holidays, reload } = useDiscipline();
  const [s, setS] = useState<SchoolSettings>(settings);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'recorder' as Role });
  const [holiday, setHoliday] = useState('');
  const editable = can.settings(role);

  const loadAdmin = useCallback(async () => {
    const p = await supabase.from('profiles').select('user_id, full_name, role, active').order('full_name');
    setProfiles((p.data ?? []) as Profile[]);
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

  async function saveClass(id: string, stage: string, grade: string) {
    const { error } = await supabase.from('classes').update({ stage: stage || null, grade_level: grade || null }).eq('id', id);
    if (error) return show(dbError(error), 'error');
    show('تم حفظ بيانات الفصل', 'success');
    reload();
  }

  async function addUser() {
    const { error } = await supabase.rpc('admin_add_profile', { p_email: newUser.email.trim(), p_name: newUser.name.trim(), p_role: newUser.role });
    if (error) return show(dbError(error), 'error');
    show('تمت إضافة صلاحية المستخدم', 'success');
    setNewUser({ email: '', name: '', role: 'recorder' });
    loadAdmin();
  }

  async function updateProfile(p: Profile, patch: Partial<Profile>) {
    const { error } = await supabase.from('profiles').update(patch).eq('user_id', p.user_id);
    if (error) return show(dbError(error), 'error');
    loadAdmin();
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
      {!editable && <Notice tone="blue">التعديل متاح لمدير المدرسة أو مدير النظام.</Notice>}

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

      <section className="card space-y-2">
        <h2 className="font-bold">المراحل والصفوف للفصول</h2>
        <p className="text-sm text-gray-600">حدّد المرحلة والصف لكل فصل ليُربط بنطاق انطباق المخالفات.</p>
        <div className="space-y-2">
          {classes.map((c) => (
            <ClassRow key={c.id} cls={c} editable={editable} onSave={saveClass} />
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">المستخدمون والأدوار</h2>
        <table className="w-full text-sm">
          <tbody>
            {profiles.map((p) => (
              <tr key={p.user_id} className="border-t border-gray-100">
                <td className="p-2">{p.full_name}</td>
                <td className="p-2">
                  <select className="input-field !w-auto" disabled={!can.admin(role)} value={p.role} onChange={(e) => updateProfile(p, { role: e.target.value as Role })}>
                    {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td className="p-2">
                  <label className="flex items-center gap-1"><input type="checkbox" disabled={!can.admin(role)} checked={p.active} onChange={(e) => updateProfile(p, { active: e.target.checked })} /> مفعّل</label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {can.admin(role) && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-sm text-gray-600">أنشئ المستخدم أولًا من لوحة Supabase (Authentication ← Users)، ثم اربطه بدور هنا بالبريد نفسه.</p>
            <div className="grid sm:grid-cols-4 gap-2">
              <input className="input-field" dir="ltr" placeholder="البريد الإلكتروني" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              <input className="input-field" placeholder="الاسم الكامل" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
              <select className="input-field" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button className="btn-primary" onClick={addUser}>ربط المستخدم</button>
            </div>
          </div>
        )}
      </section>

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

function ClassRow({ cls, editable, onSave }: { cls: { id: string; name: string; stage: string | null; grade_level: string | null }; editable: boolean; onSave: (id: string, stage: string, grade: string) => void }) {
  const [stage, setStage] = useState(cls.stage ?? '');
  const [grade, setGrade] = useState(cls.grade_level ?? '');
  return (
    <div className="grid sm:grid-cols-4 gap-2 items-center">
      <span className="font-semibold text-sm">{cls.name}</span>
      <select className="input-field" disabled={!editable} value={stage} onChange={(e) => setStage(e.target.value)}>
        <option value="">المرحلة</option>
        {STAGES.map((x) => <option key={x}>{x}</option>)}
      </select>
      <input className="input-field" disabled={!editable} placeholder="الصف (مثال: الأول الإعدادي)" value={grade} onChange={(e) => setGrade(e.target.value)} />
      {editable && <button className="btn-secondary" onClick={() => onSave(cls.id, stage, grade)}>حفظ</button>}
    </div>
  );
}
