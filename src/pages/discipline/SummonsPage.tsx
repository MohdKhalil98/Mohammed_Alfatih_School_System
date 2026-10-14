import { useEffect, useState } from 'react';
import { PhoneCall, Plus, Copy, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useDiscipline } from '@/lib/discipline/data';
import { useRecords } from '@/lib/discipline/records';
import { SUMMONS_LABELS, can } from '@/lib/discipline/constants';
import type { Summons, SummonsStatus } from '@/lib/discipline/types';
import { Badge, Field, Modal, PageTitle, StudentPicker, dbError, fmtDate, today } from '@/components/discipline/ui';
import { useAuth } from '@/lib/discipline/auth';
import type { PageProps } from './props';

export function whatsappText(s: Summons, studentName: string, schoolName: string, className: string): string {
  const when = s.proposed_at ? new Date(s.proposed_at).toLocaleString('ar-BH-u-nu-latn', { dateStyle: 'full', timeStyle: 'short' }) : 'يُحدد لاحقًا';
  return [
    `السلام عليكم ورحمة الله وبركاته`,
    `${s.guardian_name ? 'الفاضل / ' + s.guardian_name + ' المحترم' : 'ولي أمر الطالب المحترم'}`,
    `نأمل حضوركم إلى ${schoolName} بخصوص الطالب: ${studentName} (${className}).`,
    `السبب: ${s.reason}`,
    `الموعد المقترح: ${when}`,
    `رقم الاستدعاء: ${s.summons_no}`,
    `شاكرين تعاونكم.`,
  ].join('\n');
}

export default function SummonsPage({ role, onNavigate, param }: PageProps) {
  const { show } = useToast();
  const { studentOf, className, settings } = useDiscipline();
  const { summons, loading, reload } = useRecords();
  const [editing, setEditing] = useState<Partial<Summons> | null>(
    param?.student ? { student_id: param.student, incident_id: param.incident ?? null } : null
  );
  const [filter, setFilter] = useState<SummonsStatus | ''>('');

  const rows = summons.filter((s) => !filter || s.status === filter);

  async function copyWhatsApp(s: Summons) {
    const st = studentOf(s.student_id);
    const text = whatsappText(s, st?.name ?? '', settings.school_name, className(st?.class_id));
    try {
      await navigator.clipboard.writeText(text);
      show('تم نسخ الرسالة؛ الصقها في واتساب (لم يُرسل شيء تلقائيًا)', 'success');
    } catch {
      show('تعذر النسخ تلقائيًا', 'error');
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 fade-in">
      <PageTitle
        icon={<PhoneCall className="w-6 h-6" />}
        title="استدعاءات أولياء الأمور"
        sub="لا يوجد إرسال آلي؛ انسخ الرسالة وأرسلها يدويًا ثم سجّل تاريخ الإرسال"
        actions={can.write(role) && (
          <button className="btn-primary" onClick={() => setEditing({})}><Plus className="w-4 h-4" /> استدعاء جديد</button>
        )}
      />
      <div className="card mb-4 no-print">
        <select className="input-field sm:w-64" value={filter} onChange={(e) => setFilter(e.target.value as SummonsStatus | '')}>
          <option value="">كل الحالات</option>
          {(Object.keys(SUMMONS_LABELS) as SummonsStatus[]).map((k) => <option key={k} value={k}>{SUMMONS_LABELS[k]}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-500">جارٍ التحميل...</p> : rows.length === 0 ? (
        <div className="card text-center text-gray-500">لا توجد استدعاءات.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => {
            const st = studentOf(s.student_id);
            return (
              <div key={s.id} className="card text-sm">
                <div className="flex flex-wrap gap-2 items-center mb-1">
                  <b>{st?.name}</b>
                  <span className="text-gray-500">{className(st?.class_id)}</span>
                  <span className="font-mono text-xs">{s.summons_no}</span>
                  <Badge tone={s.status === 'completed' || s.status === 'attended' ? 'green' : s.status === 'absent' ? 'red' : 'blue'}>{SUMMONS_LABELS[s.status]}</Badge>
                </div>
                <p>السبب: {s.reason}</p>
                <p className="text-gray-600">
                  ولي الأمر: {s.guardian_name || '—'} ({s.contact || '—'}) — أُنشئ: {fmtDate(s.created_on)} — الموعد: {s.proposed_at ? new Date(s.proposed_at).toLocaleString('ar-BH-u-nu-latn') : '—'}
                </p>
                {s.whatsapp_sent_on && <p className="text-gray-600">أُرسلت رسالة واتساب (مسجلة يدويًا) بتاريخ {fmtDate(s.whatsapp_sent_on)}</p>}
                {s.meeting_summary && <p className="text-gray-700">ملخص المقابلة: {s.meeting_summary}</p>}
                <div className="flex flex-wrap gap-2 mt-2 no-print">
                  <button className="btn-secondary !py-1" onClick={() => copyWhatsApp(s)}><Copy className="w-4 h-4" /> نسخ رسالة واتساب</button>
                  <button className="btn-secondary !py-1" onClick={() => onNavigate('d-forms', { summons: s.id, incident: s.incident_id ?? '', student: s.student_id })}>
                    <Printer className="w-4 h-4" /> نموذج الاستدعاء
                  </button>
                  {can.write(role) && <button className="btn-secondary !py-1" onClick={() => setEditing(s)}>تعديل / توثيق المقابلة</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <SummonsForm
          initial={editing}
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

function SummonsForm({ initial, onClose, onSaved }: { initial: Partial<Summons>; onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const { profile } = useAuth();
  const { studentOf } = useDiscipline();
  const [f, setF] = useState({
    student_id: initial.student_id ?? null,
    incident_id: initial.incident_id ?? '',
    guardian_name: initial.guardian_name ?? '',
    contact: initial.contact ?? '',
    reason: initial.reason ?? '',
    proposed_at: initial.proposed_at ? initial.proposed_at.slice(0, 16) : '',
    status: (initial.status ?? 'draft') as SummonsStatus,
    whatsapp_sent_on: initial.whatsapp_sent_on ?? '',
    attended_on: initial.attended_on ?? '',
    meeting_summary: initial.meeting_summary ?? '',
    documented_by: initial.documented_by ?? profile?.full_name ?? '',
  });
  const [studentIncidents, setStudentIncidents] = useState<{ id: string; ref_no: string; incident_date: string }[]>([]);

  useEffect(() => {
    if (!f.student_id) return;
    const st = studentOf(f.student_id);
    setF((p) => ({
      ...p,
      guardian_name: p.guardian_name || st?.guardian_name || '',
      contact: p.contact || st?.guardian_phone || '',
    }));
    supabase.from('incidents').select('id,ref_no,incident_date').eq('student_id', f.student_id).order('incident_date', { ascending: false })
      .then(({ data }) => setStudentIncidents(data ?? []));
  }, [f.student_id, studentOf]);

  async function save() {
    if (!f.student_id || !f.reason.trim()) return show('اختر الطالب واكتب سبب الاستدعاء', 'warning');
    const payload = {
      student_id: f.student_id,
      incident_id: f.incident_id || null,
      guardian_name: f.guardian_name || null,
      contact: f.contact || null,
      reason: f.reason.trim(),
      proposed_at: f.proposed_at ? new Date(f.proposed_at).toISOString() : null,
      status: f.status,
      whatsapp_sent_on: f.whatsapp_sent_on || null,
      attended_on: f.attended_on || null,
      meeting_summary: f.meeting_summary || null,
      documented_by: f.documented_by || null,
    };
    const q = initial.id
      ? supabase.from('guardian_summons').update(payload).eq('id', initial.id)
      : supabase.from('guardian_summons').insert({ ...payload, created_on: today() });
    const { error } = await q;
    if (error) return show(dbError(error), 'error');
    show('تم حفظ الاستدعاء', 'success');
    onSaved();
  }

  return (
    <Modal title={initial.id ? 'تعديل الاستدعاء' : 'استدعاء جديد'} onClose={onClose} wide>
      <div className="space-y-3 text-sm">
        <StudentPicker value={f.student_id} onChange={(id) => setF({ ...f, student_id: id })} />
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="اسم ولي الأمر"><input className="input-field" value={f.guardian_name} onChange={(e) => setF({ ...f, guardian_name: e.target.value })} /></Field>
          <Field label="وسيلة التواصل (هاتف / واتساب)"><input className="input-field" dir="ltr" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
          <Field label="المخالفة المرتبطة (اختياري)">
            <select className="input-field" value={f.incident_id} onChange={(e) => setF({ ...f, incident_id: e.target.value })}>
              <option value="">بدون</option>
              {studentIncidents.map((i) => <option key={i.id} value={i.id}>{i.ref_no} — {fmtDate(i.incident_date)}</option>)}
            </select>
          </Field>
          <Field label="الموعد المقترح للحضور"><input type="datetime-local" className="input-field" value={f.proposed_at} onChange={(e) => setF({ ...f, proposed_at: e.target.value })} /></Field>
        </div>
        <Field label="سبب الاستدعاء" required><textarea className="input-field" rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="الحالة">
            <select className="input-field" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as SummonsStatus })}>
              {(Object.keys(SUMMONS_LABELS) as SummonsStatus[]).map((k) => <option key={k} value={k}>{SUMMONS_LABELS[k]}</option>)}
            </select>
          </Field>
          <Field label="تاريخ إرسال واتساب (يدوي)"><input type="date" className="input-field" value={f.whatsapp_sent_on} onChange={(e) => setF({ ...f, whatsapp_sent_on: e.target.value })} /></Field>
          <Field label="تاريخ الحضور الفعلي"><input type="date" className="input-field" value={f.attended_on} onChange={(e) => setF({ ...f, attended_on: e.target.value })} /></Field>
        </div>
        <Field label="ملخص المقابلة"><textarea className="input-field" rows={3} value={f.meeting_summary} onChange={(e) => setF({ ...f, meeting_summary: e.target.value })} /></Field>
        <Field label="الموظف الذي وثّق المقابلة"><input className="input-field" value={f.documented_by} onChange={(e) => setF({ ...f, documented_by: e.target.value })} /></Field>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" onClick={save}>حفظ</button>
        </div>
      </div>
    </Modal>
  );
}
