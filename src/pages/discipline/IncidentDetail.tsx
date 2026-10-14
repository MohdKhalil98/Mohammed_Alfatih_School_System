import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Scale, PhoneCall, Paperclip } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useDiscipline } from '@/lib/discipline/data';
import {
  ACTION_LABELS, APPROVAL_LABELS, APPROVER_ONLY_INCIDENT_STATUS, INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_ORDER, STATUS_PENDING_NOTE, can, pledgeLabel,
} from '@/lib/discipline/constants';
import type { ActionType, Incident, IncidentAction, IncidentStatus, Role } from '@/lib/discipline/types';
import { Badge, CategoryBadge, ConfirmModal, Field, Modal, Notice, dbError, fmtDate, today } from '@/components/discipline/ui';
import type { NavFn } from './props';

type Attachment = { id: string; file_name: string; file_path: string };

export default function IncidentDetail({
  incidentId, role, onClose, onNavigate, onChanged,
}: { incidentId: string; role: Role; onClose: () => void; onNavigate: NavFn; onChanged?: () => void }) {
  const { show } = useToast();
  const { studentOf, classOf, violationOf, categoryOf } = useDiscipline();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [actions, setActions] = useState<IncidentAction[]>([]);
  const [prior, setPrior] = useState<Incident[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; message: string; run: () => Promise<void> }>(null);

  const load = useCallback(async () => {
    const { data: inc, error } = await supabase.from('incidents').select('*').eq('id', incidentId).single();
    if (error || !inc) {
      show(dbError(error), 'error');
      return;
    }
    setIncident(inc as Incident);
    const [a, p, f] = await Promise.all([
      supabase.from('incident_actions').select('*').eq('incident_id', incidentId).order('action_no'),
      supabase.from('incidents').select('*').eq('student_id', inc.student_id).neq('id', incidentId).order('incident_date', { ascending: false }),
      supabase.from('attachments').select('id,file_name,file_path').eq('incident_id', incidentId),
    ]);
    setActions((a.data ?? []) as IncidentAction[]);
    setPrior((p.data ?? []) as Incident[]);
    setFiles((f.data ?? []) as Attachment[]);
  }, [incidentId, show]);

  useEffect(() => {
    load();
  }, [load]);

  const violation = violationOf(incident?.violation_id);
  const student = studentOf(incident?.student_id);
  const repeats = useMemo(() => prior.filter((p) => p.violation_id === incident?.violation_id), [prior, incident]);

  if (!incident) return null;

  async function setStatus(s: IncidentStatus) {
    const { error } = await supabase.from('incidents').update({ status: s }).eq('id', incidentId);
    if (error) return show(dbError(error), 'error');
    show('تم تحديث حالة الواقعة', 'success');
    load();
    onChanged?.();
  }

  async function approveAction(a: IncidentAction) {
    const { error } = await supabase.from('incident_actions').update({ approval_status: 'approved' }).eq('id', a.id);
    if (error) return show(dbError(error), 'error');
    show('تم اعتماد الإجراء', 'success');
    load();
  }

  async function openFile(f: Attachment) {
    const { data, error } = await supabase.storage.from('discipline-evidence').createSignedUrl(f.file_path, 60);
    if (error || !data) return show('تعذر فتح المرفق', 'error');
    window.open(data.signedUrl, '_blank');
  }

  return (
    <Modal title={`واقعة ${incident.ref_no}`} onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          {violation && <CategoryBadge id={violation.category_id} />}
          <Badge tone="blue">{INCIDENT_STATUS_LABELS[incident.status]}</Badge>
          <span className="text-gray-500">لا يعني تسجيل الواقعة ثبوت المخالفة أو اعتماد عقوبة.</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
          <p><b>الطالب:</b> {student?.name} ({student?.school_number || 'بلا رقم مدرسي'})</p>
          <p><b>الفصل:</b> {classOf(student?.class_id)?.name}</p>
          <p><b>التاريخ والوقت:</b> {fmtDate(incident.incident_date)} — {incident.incident_time.slice(0, 5)}</p>
          <p><b>المكان:</b> {incident.location}</p>
          <p><b>الراصد:</b> {incident.observer_name}</p>
          <p><b>الشهود:</b> {incident.witnesses || '—'}</p>
          <p className="sm:col-span-2"><b>المخالفة:</b> {violation?.code} — {violation?.official_name}</p>
          <p className="sm:col-span-2">
            <b>المرجع:</b> {categoryOf(violation?.category_id)?.article}
            {violation?.clause ? ` — البند ${violation.clause}` : ' — رقم البند غير مدخل بعد'}
          </p>
          {violation?.reference_text && <p className="sm:col-span-2 text-gray-700">«{violation.reference_text}»</p>}
          <p className="sm:col-span-2"><b>وصف الواقعة:</b> {incident.description}</p>
          {incident.source_attendance_date && (
            <p className="sm:col-span-2 text-blue-700">
              مرتبطة بسجل حضور: {fmtDate(incident.source_attendance_date)} ({incident.source_attendance_status})
            </p>
          )}
        </div>

        {violation?.status === 'pending_review' && <Notice>{STATUS_PENDING_NOTE}</Notice>}
        {repeats.length > 0 && (
          <Notice tone="red">
            مخالفة متكررة: سُجلت {repeats.length} واقعة سابقة من النوع نفسه لهذا الطالب. التكرار تنبيه للمراجعة فقط ولا يفرض عقوبة تلقائية؛ يُرجع إلى قواعد التكرار في اللائحة.
          </Notice>
        )}

        {/* الحالة */}
        {can.write(role) && (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="تغيير حالة الواقعة">
              <select
                className="input-field"
                value={incident.status}
                onChange={(e) => {
                  const s = e.target.value as IncidentStatus;
                  if (APPROVER_ONLY_INCIDENT_STATUS.includes(s) && !can.approve(role)) {
                    show('هذه الحالة متاحة لمدير المدرسة أو مدير النظام فقط', 'warning');
                    return;
                  }
                  setConfirm({
                    title: 'تأكيد تغيير الحالة',
                    message: `سيتم تغيير الحالة إلى «${INCIDENT_STATUS_LABELS[s]}».`,
                    run: () => setStatus(s),
                  });
                }}
              >
                {INCIDENT_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{INCIDENT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {/* السوابق */}
        <section>
          <h3 className="font-bold mb-2">سوابق الطالب ({prior.length})</h3>
          {prior.length === 0 ? (
            <p className="text-gray-500">لا توجد وقائع سابقة.</p>
          ) : (
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {prior.map((p) => (
                <li key={p.id} className="flex gap-2 text-gray-700">
                  <span>{fmtDate(p.incident_date)}</span>
                  <span>{violationOf(p.violation_id)?.official_name}</span>
                  <Badge>{INCIDENT_STATUS_LABELS[p.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* الإجراءات */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold">الإجراءات المرتبطة ({actions.length})</h3>
            {can.write(role) && (
              <button className="btn-primary" onClick={() => setAdding(true)}>
                <Plus className="w-4 h-4" /> إضافة إجراء
              </button>
            )}
          </div>
          {actions.length === 0 && <p className="text-gray-500">لا توجد إجراءات بعد.</p>}
          <div className="space-y-2">
            {actions.map((a) => (
              <div key={a.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex flex-wrap gap-2 items-center mb-1">
                  <b>#{a.action_no} {ACTION_LABELS[a.action_type]}</b>
                  {a.pledge_no && <Badge tone="amber">{pledgeLabel(a.pledge_no)} (ترقيم توثيقي)</Badge>}
                  <Badge tone={a.approval_status === 'approved' ? 'green' : a.approval_status === 'rejected' ? 'red' : 'gray'}>
                    {APPROVAL_LABELS[a.approval_status]}
                  </Badge>
                  <span className="text-gray-500">{fmtDate(a.action_date)} — {a.responsible_staff}</span>
                </div>
                <p>{a.reason}</p>
                {a.document_text && <p className="text-gray-600 mt-1">نص المستند: {a.document_text}</p>}
                <p className="text-xs text-gray-500 mt-1">
                  إبلاغ ولي الأمر: {fmtDate(a.guardian_notified_on)} — التنفيذ: {fmtDate(a.executed_on)}
                  {a.followup_due ? ` — موعد المتابعة: ${fmtDate(a.followup_due)}` : ''}
                </p>
                {a.followup_result && <p className="text-xs">نتيجة المتابعة: {a.followup_result}</p>}
                {a.notes && <p className="text-xs text-gray-500">ملاحظات: {a.notes}</p>}
                {can.approve(role) && a.approval_status !== 'approved' && (
                  <button
                    className="btn-success mt-2 !py-1"
                    onClick={() =>
                      setConfirm({ title: 'اعتماد الإجراء', message: 'سيصبح الإجراء معتمدًا ولا يمكن تعديله إلا بصلاحية.', run: () => approveAction(a) })
                    }
                  >
                    اعتماد
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* المرفقات */}
        {files.length > 0 && (
          <section>
            <h3 className="font-bold mb-1">المرفقات</h3>
            <ul>
              {files.map((f) => (
                <li key={f.id}>
                  <button className="text-blue-700 underline flex gap-1 items-center" onClick={() => openFile(f)}>
                    <Paperclip className="w-3 h-3" /> {f.file_name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <button className="btn-secondary" onClick={() => onNavigate('d-forms', { incident: incident.id })}>
            <Printer className="w-4 h-4" /> نماذج هذه الواقعة
          </button>
          {can.write(role) && (
            <button className="btn-secondary" onClick={() => onNavigate('d-summons', { incident: incident.id, student: incident.student_id })}>
              <PhoneCall className="w-4 h-4" /> استدعاء ولي أمر
            </button>
          )}
          {can.committee(role) && (
            <button className="btn-secondary" onClick={() => onNavigate('d-committee', { incident: incident.id })}>
              <Scale className="w-4 h-4" /> إحالة إلى اللجنة
            </button>
          )}
          <button className="btn-secondary" onClick={() => onNavigate('d-student', { student: incident.student_id })}>
            ملف الطالب
          </button>
        </div>
      </div>

      {adding && (
        <AddAction
          incident={incident}
          existing={actions}
          prior={prior}
          role={role}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
            onChanged?.();
          }}
        />
      )}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await confirm.run();
            setConfirm(null);
          }}
        />
      )}
    </Modal>
  );
}

function AddAction({
  incident, existing, prior, role, onClose, onSaved,
}: { incident: Incident; existing: IncidentAction[]; prior: Incident[]; role: Role; onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const { violationOf, className, studentOf } = useDiscipline();
  const violation = violationOf(incident.violation_id);
  const [form, setForm] = useState({
    action_type: 'verbal_warning' as ActionType,
    pledge_no: '',
    action_date: today(),
    responsible_staff: '',
    reason: '',
    relation_note: '',
    document_text: '',
    guardian_notified_on: '',
    executed_on: '',
    followup_due: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [priorActions, setPriorActions] = useState<IncidentAction[]>([]);

  // عرض الإجراءات السابقة للطالب قبل تسجيل الجديد
  useEffect(() => {
    const ids = prior.map((p) => p.id);
    if (!ids.length) return;
    supabase.from('incident_actions').select('*').in('incident_id', ids).order('action_date', { ascending: false }).limit(20)
      .then(({ data }) => setPriorActions((data ?? []) as IncidentAction[]));
  }, [prior]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const remedyNotListed =
    violation?.status === 'verified' && violation.allowed_remedies.length > 0 && !violation.allowed_remedies.includes(form.action_type);

  async function save() {
    if (!form.responsible_staff.trim() || !form.reason.trim()) {
      return show('أدخل الموظف المسؤول وسبب الإجراء', 'warning');
    }
    setBusy(true);
    const nextNo = existing.reduce((m, a) => Math.max(m, a.action_no), 0) + 1;
    const { error } = await supabase.from('incident_actions').insert({
      incident_id: incident.id,
      action_type: form.action_type,
      action_no: nextNo,
      pledge_no: form.action_type === 'pledge' && form.pledge_no ? Number(form.pledge_no) : null,
      action_date: form.action_date,
      responsible_staff: form.responsible_staff.trim(),
      reason: form.reason.trim(),
      relation_note: form.relation_note || null,
      document_text: form.document_text || null,
      approval_status: 'draft',
      guardian_notified_on: form.guardian_notified_on || null,
      executed_on: form.executed_on || null,
      followup_due: form.followup_due || null,
      notes: form.notes || null,
    });
    setBusy(false);
    if (error) return show(dbError(error), 'error');
    show('تم حفظ الإجراء', 'success');
    onSaved();
  }

  void role;
  return (
    <Modal title="إضافة إجراء" onClose={onClose} wide>
      <div className="space-y-3 text-sm">
        <Notice tone="blue">
          الطالب: {studentOf(incident.student_id)?.name} — {className(incident.class_id)}. تسجيل الإجراء لا يعني اعتماده؛ يبقى مسودة حتى يعتمده مدير المدرسة.
        </Notice>
        {violation?.status === 'pending_review' && <Notice>{STATUS_PENDING_NOTE} تأكد من أن الإجراء ضمن المعالجات الواردة في اللائحة.</Notice>}
        {prior.length > 0 && (
          <Notice tone="red">
            لدى الطالب {prior.length} واقعة سابقة و{priorActions.length} إجراء سابق. راجعها أدناه؛ لا تُفرض عقوبة تلقائية بسبب العدد.
          </Notice>
        )}
        {priorActions.length > 0 && (
          <ul className="max-h-28 overflow-y-auto bg-gray-50 rounded p-2 space-y-1">
            {priorActions.map((a) => (
              <li key={a.id}>
                {fmtDate(a.action_date)} — {ACTION_LABELS[a.action_type]} {a.pledge_no ? `(${pledgeLabel(a.pledge_no)})` : ''} — {APPROVAL_LABELS[a.approval_status]}
              </li>
            ))}
          </ul>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="نوع الإجراء" required>
            <select className="input-field" value={form.action_type} onChange={(e) => set('action_type', e.target.value)}>
              {(Object.keys(ACTION_LABELS) as ActionType[]).map((k) => (
                <option key={k} value={k}>{ACTION_LABELS[k]}</option>
              ))}
            </select>
          </Field>
          {form.action_type === 'pledge' && (
            <Field label="ترقيم التعهد (توثيقي فقط)" hint="لا يعني أن التعهد الثاني يلي الأول تلقائيًا">
              <select className="input-field" value={form.pledge_no} onChange={(e) => set('pledge_no', e.target.value)}>
                <option value="">بدون ترقيم</option>
                <option value="1">التعهد الأول</option>
                <option value="2">التعهد الثاني</option>
                <option value="3">التعهد الثالث</option>
                <option value="4">تعهد إضافي (4)</option>
                <option value="5">تعهد إضافي (5)</option>
              </select>
            </Field>
          )}
          <Field label="تاريخ اتخاذ الإجراء" required>
            <input type="date" className="input-field" value={form.action_date} onChange={(e) => set('action_date', e.target.value)} />
          </Field>
          <Field label="الموظف المسؤول" required>
            <input className="input-field" value={form.responsible_staff} onChange={(e) => set('responsible_staff', e.target.value)} />
          </Field>
        </div>
        {remedyNotListed && <Notice>هذا الإجراء غير مدرج ضمن المعالجات المعتمدة لهذه المخالفة في قاعدة المخالفات.</Notice>}
        <Field label="سبب اتخاذ الإجراء" required>
          <textarea className="input-field" rows={2} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
        </Field>
        <Field label="علاقة الإجراء بالمخالفة">
          <input className="input-field" value={form.relation_note} onChange={(e) => set('relation_note', e.target.value)} />
        </Field>
        <Field label="نص المستند">
          <textarea className="input-field" rows={3} value={form.document_text} onChange={(e) => set('document_text', e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="تاريخ إبلاغ ولي الأمر">
            <input type="date" className="input-field" value={form.guardian_notified_on} onChange={(e) => set('guardian_notified_on', e.target.value)} />
          </Field>
          <Field label="تاريخ التنفيذ">
            <input type="date" className="input-field" value={form.executed_on} onChange={(e) => set('executed_on', e.target.value)} />
          </Field>
          <Field label="موعد المتابعة">
            <input type="date" className="input-field" value={form.followup_due} onChange={(e) => set('followup_due', e.target.value)} />
          </Field>
        </div>
        <Field label="ملاحظات">
          <input className="input-field" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ الإجراء'}</button>
        </div>
      </div>
    </Modal>
  );
}
