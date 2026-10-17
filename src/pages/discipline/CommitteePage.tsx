import { useState } from 'react';
import { Scale, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useDiscipline } from '@/lib/discipline/data';
import { useRecords } from '@/lib/discipline/records';
import { APPEAL_LABELS, REFERRAL_STATUS_LABELS, can } from '@/lib/discipline/constants';
import { addWorkdays, deadlineState, type DeadlineState } from '@/lib/discipline/workdays';
import type { Referral } from '@/lib/discipline/types';
import { Badge, Field, Modal, Notice, PageTitle, dbError, fmtDate, today } from '@/components/discipline/ui';
import type { PageProps } from './props';

type RefKey = keyof Referral;

function DeadlineBadge({ label, due, state }: { label: string; due: string; state: DeadlineState }) {
  const tone = state === 'overdue' ? 'red' : state === 'due-soon' ? 'amber' : 'gray';
  const txt = state === 'overdue' ? 'متأخر' : state === 'due-soon' ? 'يقترب' : 'ضمن المدة';
  return <Badge tone={tone}>{label}: {fmtDate(due)} ({txt})</Badge>;
}

export default function CommitteePage({ role, onNavigate, param }: PageProps) {
  const { studentOf, violationOf, settings, calendar } = useDiscipline();
  const { incidents, referrals, loading, reload } = useRecords();
  const [editing, setEditing] = useState<Referral | 'new' | null>(param?.incident ? 'new' : null);
  const t = today();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 fade-in">
      <PageTitle
        icon={<Scale className="w-6 h-6" />}
        title="لجنة الانضباط والتحقيقات"
        sub="المدد محسوبة بأيام العمل وفق تقويم المدرسة المسجل في الإعدادات"
        actions={can.committee(role) && (
          <button className="btn-primary" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> إحالة جديدة</button>
        )}
      />
      {!settings.periods_verified && (
        <div className="mb-4">
          <Notice>المدد (توصية: {settings.committee_recommendation_days} أيام عمل، إخطار: {settings.guardian_notice_days}، تظلم: {settings.appeal_days}) مأخوذة من ملخص اللائحة وتحتاج مطابقة مع النص الرسمي ثم تأكيدها من الإعدادات.</Notice>
        </div>
      )}
      {loading ? <p className="text-gray-500">جارٍ التحميل...</p> : referrals.length === 0 ? (
        <div className="card text-center text-gray-500">لا توجد إحالات.</div>
      ) : (
        <div className="space-y-3">
          {referrals.map((r) => {
            const inc = incidents.find((i) => i.id === r.incident_id);
            const recDue = addWorkdays(r.referred_on, settings.committee_recommendation_days, calendar);
            const noticeDue = r.decision_date ? addWorkdays(r.decision_date, settings.guardian_notice_days, calendar) : null;
            const appealDue = (r.guardian_notified_on || r.decision_date)
              ? addWorkdays((r.guardian_notified_on || r.decision_date)!, settings.appeal_days, calendar)
              : null;
            return (
              <div key={r.id} className="card text-sm">
                <div className="flex flex-wrap gap-2 items-center mb-1">
                  <b>{studentOf(r.student_id)?.name}</b>
                  <span className="font-mono text-xs">{r.referral_no}</span>
                  <Badge tone="blue">{REFERRAL_STATUS_LABELS[r.status]}</Badge>
                  {r.appeal_status !== 'none' && <Badge tone="amber">تظلم: {APPEAL_LABELS[r.appeal_status]}</Badge>}
                </div>
                <p>المخالفة: {violationOf(inc?.violation_id)?.code} {violationOf(inc?.violation_id)?.official_name}</p>
                <p>تاريخ الإحالة: {fmtDate(r.referred_on)} — السبب: {r.reason}</p>
                {r.recommendation && <p>التوصية: {r.recommendation}</p>}
                {r.final_decision && <p className="font-semibold">القرار النهائي: {r.final_decision} ({fmtDate(r.decision_date)})</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {!r.recommendation_date && <DeadlineBadge label="رفع التوصية" due={recDue} state={deadlineState(recDue, t, calendar)} />}
                  {noticeDue && !r.guardian_notified_on && <DeadlineBadge label="إخطار ولي الأمر" due={noticeDue} state={deadlineState(noticeDue, t, calendar)} />}
                  {appealDue && r.appeal_status === 'none' && <Badge tone="gray">آخر موعد للتظلم: {fmtDate(appealDue)}</Badge>}
                </div>
                <div className="flex gap-2 mt-2 no-print">
                  <button className="btn-secondary !py-1" onClick={() => setEditing(r)}>{can.committee(role) ? 'تحرير' : 'عرض'}</button>
                  <button className="btn-secondary !py-1" onClick={() => onNavigate('d-forms', { referral: r.id, incident: r.incident_id })}>نماذج الإحالة</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <ReferralForm
          initial={editing === 'new' ? null : editing}
          presetIncident={param?.incident}
          role={role}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ReferralForm({
  initial, presetIncident, role, onClose, onSaved,
}: { initial: Referral | null; presetIncident?: string; role: PageProps['role']; onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const { studentOf, violationOf } = useDiscipline();
  const { incidents } = useRecords();
  const [f, setF] = useState<Partial<Referral>>(
    initial ?? { incident_id: presetIncident ?? '', referred_on: today(), appeal_status: 'none', status: 'open' }
  );
  const readOnly = !can.committee(role);
  const set = (k: RefKey, v: string) => setF((p) => ({ ...p, [k]: v === '' ? null : v }));
  const inp = (k: RefKey) => (f[k] as string | null | undefined) ?? '';

  async function save() {
    if (!f.incident_id || !f.reason?.trim()) return show('اختر الواقعة واكتب سبب الإحالة', 'warning');
    const inc = incidents.find((i) => i.id === f.incident_id);
    if (!inc) return show('الواقعة غير موجودة', 'error');
    const payload = { ...f, student_id: inc.student_id };
    delete (payload as { id?: string }).id;
    delete (payload as { referral_no?: string }).referral_no;
    const q = initial
      ? supabase.from('committee_referrals').update(payload).eq('id', initial.id)
      : supabase.from('committee_referrals').insert(payload);
    const { error } = await q;
    if (error) return show(dbError(error), 'error');
    show('تم حفظ الإحالة', 'success');
    onSaved();
  }

  const area = (k: RefKey, label: string, rows = 3) => (
    <Field label={label}>
      <textarea className="input-field" rows={rows} disabled={readOnly} value={inp(k)} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );

  return (
    <Modal title={initial ? `الإحالة ${initial.referral_no}` : 'إحالة جديدة إلى اللجنة'} onClose={onClose} wide>
      <div className="space-y-3 text-sm">
        <Field label="الواقعة" required>
          <select className="input-field" disabled={!!initial || readOnly} value={inp('incident_id')} onChange={(e) => set('incident_id', e.target.value)}>
            <option value="">اختر الواقعة</option>
            {incidents.map((i) => (
              <option key={i.id} value={i.id}>
                {i.ref_no} — {studentOf(i.student_id)?.name} — {violationOf(i.violation_id)?.official_name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="تاريخ الإحالة" required><input type="date" className="input-field" disabled={readOnly} value={inp('referred_on')} onChange={(e) => set('referred_on', e.target.value)} /></Field>
          <Field label="حالة الإحالة">
            <select className="input-field" disabled={readOnly} value={inp('status')} onChange={(e) => set('status', e.target.value)}>
              {Object.entries(REFERRAL_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        {area('reason', 'سبب الإحالة', 2)}
        {area('investigation_minutes', 'محضر التحقيق', 4)}
        {area('student_statement', 'أقوال الطالب')}
        {area('witness_statements', 'أقوال الشهود')}
        {area('evidence_notes', 'الأدلة والمرفقات (وصف)', 2)}
        {area('recommendation', 'توصية اللجنة')}
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="تاريخ التوصية"><input type="date" className="input-field" disabled={readOnly} value={inp('recommendation_date')} onChange={(e) => set('recommendation_date', e.target.value)} /></Field>
          <Field label="المسؤول الذي راجع التوصية"><input className="input-field" disabled={readOnly} value={inp('reviewer_name')} onChange={(e) => set('reviewer_name', e.target.value)} /></Field>
          <Field label="جهة الاعتماد"><input className="input-field" disabled={readOnly} value={inp('approving_authority')} onChange={(e) => set('approving_authority', e.target.value)} /></Field>
        </div>
        {can.write(role) && (
          <div className="grid sm:grid-cols-2 gap-3 border-t pt-3">
            <Field label="القرار النهائي"><textarea className="input-field" rows={2} value={inp('final_decision')} onChange={(e) => set('final_decision', e.target.value)} /></Field>
            <Field label="تاريخ القرار"><input type="date" className="input-field" value={inp('decision_date')} onChange={(e) => set('decision_date', e.target.value)} /></Field>
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="تاريخ إبلاغ ولي الأمر"><input type="date" className="input-field" disabled={readOnly} value={inp('guardian_notified_on')} onChange={(e) => set('guardian_notified_on', e.target.value)} /></Field>
          <Field label="حالة التظلم">
            <select className="input-field" disabled={readOnly} value={inp('appeal_status')} onChange={(e) => set('appeal_status', e.target.value)}>
              {Object.entries(APPEAL_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="تاريخ التظلم"><input type="date" className="input-field" disabled={readOnly} value={inp('appeal_date')} onChange={(e) => set('appeal_date', e.target.value)} /></Field>
        </div>
        {area('followup_notes', 'متابعة تنفيذ القرار', 2)}
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>إغلاق</button>
          {!readOnly && <button className="btn-primary" onClick={save}>حفظ</button>}
        </div>
      </div>
    </Modal>
  );
}
