import { useEffect, useMemo, useState } from 'react';
import { FilePlus2, Paperclip } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/discipline/auth';
import { useDiscipline } from '@/lib/discipline/data';
import { INCIDENT_STATUS_LABELS, LOCATIONS, STATUS_PENDING_NOTE, can } from '@/lib/discipline/constants';
import type { Incident } from '@/lib/discipline/types';
import {
  Badge, CategoryBadge, ConfirmModal, Field, Notice, PageTitle, StudentPicker, dbError, fmtDate, today,
} from '@/components/discipline/ui';
import type { PageProps } from './props';

const DRAFT_KEY = 'discipline-incident-draft';

type Form = {
  student_id: string | null;
  incident_date: string;
  incident_time: string;
  location: string;
  category_id: string;
  violation_id: string;
  description: string;
  observer_name: string;
  witnesses: string;
};

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function loadDraft(): Partial<Form> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<Form>) : null;
  } catch {
    return null;
  }
}

export default function NewIncident({ role, onNavigate, param }: PageProps) {
  const { show } = useToast();
  const { profile } = useAuth();
  const { categories, currentViolations, studentOf, classOf, categoryOf } = useDiscipline();
  const [form, setForm] = useState<Form>(() => ({
    student_id: param?.student ?? null,
    incident_date: param?.date ?? today(),
    incident_time: nowTime(),
    location: LOCATIONS[0],
    category_id: '',
    violation_id: '',
    description: '',
    observer_name: profile?.full_name ?? '',
    witnesses: '',
    ...(param?.student ? {} : loadDraft() ?? {}),
  }));
  const [files, setFiles] = useState<File[]>([]);
  const [prior, setPrior] = useState<Incident[]>([]);
  const [busy, setBusy] = useState(false);
  const [dupConfirm, setDupConfirm] = useState<Incident | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // حفظ المسودة محليًا حتى لا يضيع الإدخال عند الرجوع
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, student_id: null }));
    } catch {
      /* التخزين المحلي اختياري */
    }
  }, [form]);

  const student = studentOf(form.student_id);
  const cls = classOf(student?.class_id);

  useEffect(() => {
    if (!form.student_id) {
      setPrior([]);
      return;
    }
    supabase.from('incidents').select('*').eq('student_id', form.student_id).order('incident_date', { ascending: false })
      .then(({ data }) => setPrior((data ?? []) as Incident[]));
  }, [form.student_id]);

  const violationChoices = useMemo(() => {
    if (!form.category_id) return [];
    return currentViolations.filter(
      (v) =>
        v.category_id === Number(form.category_id) &&
        (v.applicable_stages.length === 0 || !cls?.stage || v.applicable_stages.includes(cls.stage)) &&
        (v.applicable_grades.length === 0 || !cls?.grade_level || v.applicable_grades.includes(cls.grade_level))
    );
  }, [form.category_id, currentViolations, cls]);

  const violation = currentViolations.find((v) => v.id === form.violation_id);
  const repeats = prior.filter((p) => p.violation_id === form.violation_id);
  const sameDay = prior.find((p) => p.violation_id === form.violation_id && p.incident_date === form.incident_date);

  if (!can.write(role)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Notice tone="red">صلاحيتك الحالية لا تسمح بتسجيل الوقائع.</Notice>
      </div>
    );
  }

  async function save(skipDupCheck = false) {
    if (!form.student_id || !form.violation_id || !form.description.trim() || !form.observer_name.trim() || !form.location) {
      return show('أكمل الحقول المطلوبة: الطالب، المخالفة، الوصف، الراصد، المكان', 'warning');
    }
    if (!skipDupCheck && sameDay) {
      setDupConfirm(sameDay);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from('incidents')
      .insert({
        student_id: form.student_id,
        class_id: student?.class_id ?? null,
        violation_id: form.violation_id,
        incident_date: form.incident_date,
        incident_time: form.incident_time,
        location: form.location,
        description: form.description.trim(),
        observer_name: form.observer_name.trim(),
        witnesses: form.witnesses.trim() || null,
        status: 'new',
        source_attendance_date: param?.date ?? null,
        source_attendance_status: param?.status ?? null,
      })
      .select('id, ref_no')
      .single();

    if (error || !data) {
      setBusy(false);
      return show(dbError(error), 'error');
    }

    // رفع المرفقات (إن وُجدت وكانت الصلاحية تسمح)
    let failed = 0;
    if (can.evidence(role)) {
      for (const f of files) {
        const path = `${data.id}/${Date.now()}-${f.name.replace(/[^\w.\-؀-ۿ]/g, '_')}`;
        const up = await supabase.storage.from('discipline-evidence').upload(path, f);
        if (up.error) {
          failed++;
          continue;
        }
        const meta = await supabase.from('attachments').insert({
          incident_id: data.id, file_path: path, file_name: f.name, mime_type: f.type, size_bytes: f.size,
        });
        if (meta.error) failed++;
      }
    }
    setBusy(false);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* لا شيء */
    }
    show(
      `تم حفظ الواقعة برقم ${data.ref_no}` + (failed ? ` (تعذر رفع ${failed} مرفق)` : ''),
      failed ? 'warning' : 'success'
    );
    onNavigate('d-incidents', { open: data.id });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 fade-in">
      <PageTitle icon={<FilePlus2 className="w-6 h-6" />} title="تسجيل مخالفة جديدة" sub="تسجيل الواقعة لا يعني ثبوت المخالفة أو اعتماد أي عقوبة" />

      {param?.date && (
        <div className="mb-4">
          <Notice tone="blue">
            الواقعة مرتبطة بسجل حضور بتاريخ {fmtDate(param.date)} ({param.status}). راجع الشروط الواردة في اللائحة قبل الحفظ؛ لا يُسجَّل شيء تلقائيًا.
          </Notice>
        </div>
      )}

      <div className="card space-y-4">
        <StudentPicker value={form.student_id} onChange={(id) => set('student_id', id)} />

        {student && prior.length > 0 && (
          <Notice tone={repeats.length ? 'red' : 'amber'}>
            لدى الطالب {prior.length} واقعة سابقة
            {repeats.length ? ` منها ${repeats.length} من النوع نفسه (تكرار)` : ''}. التكرار تنبيه للمراجعة ولا يفرض عقوبة تلقائية.
            <ul className="mt-1 list-disc pr-4">
              {prior.slice(0, 4).map((p) => (
                <li key={p.id}>{fmtDate(p.incident_date)} — {INCIDENT_STATUS_LABELS[p.status]}</li>
              ))}
            </ul>
          </Notice>
        )}

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="تاريخ الواقعة" required>
            <input type="date" className="input-field" value={form.incident_date} max={today()} onChange={(e) => set('incident_date', e.target.value)} />
          </Field>
          <Field label="وقت الواقعة" required>
            <input type="time" className="input-field" value={form.incident_time} onChange={(e) => set('incident_time', e.target.value)} />
          </Field>
          <Field label="مكان الواقعة" required>
            <select className="input-field" value={form.location} onChange={(e) => set('location', e.target.value)}>
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="فئة المخالفة" required>
            <select
              className="input-field"
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value, violation_id: '' }))}
            >
              <option value="">اختر الفئة</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.symbol} {c.name} — {c.article}</option>
              ))}
            </select>
          </Field>
          <Field label="المخالفة (من القائمة الرسمية)" required>
            <select className="input-field" value={form.violation_id} onChange={(e) => set('violation_id', e.target.value)} disabled={!form.category_id}>
              <option value="">اختر المخالفة</option>
              {violationChoices.map((v) => (
                <option key={v.id} value={v.id}>{v.code} — {v.official_name}</option>
              ))}
            </select>
          </Field>
        </div>

        {violation && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex flex-wrap gap-2 items-center">
              <CategoryBadge id={violation.category_id} />
              <Badge tone={violation.status === 'verified' ? 'green' : 'amber'}>
                {violation.status === 'verified' ? 'معتمدة من المسؤول' : 'بانتظار مراجعة المسؤول'}
              </Badge>
            </div>
            <p>
              <b>المرجع:</b> {categoryOf(violation.category_id)?.article}
              {violation.clause ? ` — البند ${violation.clause}` : ' — رقم البند غير مدخل بعد'}
            </p>
            {violation.reference_text ? <p className="text-gray-700">«{violation.reference_text}»</p> : <p className="text-gray-500">النص المرجعي غير مدخل بعد.</p>}
            {violation.status === 'pending_review' && <Notice>{STATUS_PENDING_NOTE}</Notice>}
          </div>
        )}

        <Field label="وصف موضوعي للواقعة" required hint="اكتب ما حدث دون أحكام أو استنتاجات">
          <textarea className="input-field" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="الموظف الذي رصد الواقعة" required>
            <input className="input-field" value={form.observer_name} onChange={(e) => set('observer_name', e.target.value)} />
          </Field>
          <Field label="الشهود (إن وجدوا)">
            <input className="input-field" value={form.witnesses} onChange={(e) => set('witnesses', e.target.value)} />
          </Field>
        </div>

        {can.evidence(role) && (
          <Field label="المستندات / الأدلة (اختياري)">
            <label className="btn-secondary cursor-pointer w-fit">
              <Paperclip className="w-4 h-4" /> إرفاق ملفات
              <input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            </label>
            {files.length > 0 && <p className="text-xs text-gray-600 mt-1">{files.map((f) => f.name).join('، ')}</p>}
          </Field>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t">
          <button className="btn-secondary" onClick={() => onNavigate('d-dashboard')}>رجوع (المسودة محفوظة)</button>
          <button className="btn-primary" onClick={() => save()} disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ الواقعة'}</button>
        </div>
      </div>

      {dupConfirm && (
        <ConfirmModal
          title="واقعة مشابهة في اليوم نفسه"
          message={
            <>
              سُجلت للطالب واقعة من النوع نفسه بتاريخ {fmtDate(dupConfirm.incident_date)} ({dupConfirm.ref_no}). هل هذه واقعة مختلفة فعلًا؟
              إن كانت الواقعة نفسها فلا تسجلها مرة ثانية.
            </>
          }
          confirmLabel="نعم، واقعة مختلفة"
          onCancel={() => setDupConfirm(null)}
          onConfirm={() => {
            setDupConfirm(null);
            save(true);
          }}
        />
      )}
    </div>
  );
}
