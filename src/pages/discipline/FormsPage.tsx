import { useCallback, useEffect, useMemo, useState } from 'react';
import { Printer, Save, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/discipline/auth';
import { useDiscipline } from '@/lib/discipline/data';
import { logEvent } from '@/lib/discipline/audit';
import { DOC_TYPES, can } from '@/lib/discipline/constants';
import { buildDoc, type DocCtx, type DocModel } from '@/lib/discipline/templates';
import type { DocRow, Incident, IncidentAction, Referral, Summons } from '@/lib/discipline/types';
import DocView from '@/components/discipline/DocView';
import { Badge, Field, Notice, PageTitle, StudentPicker, dbError, fmtDate } from '@/components/discipline/ui';
import type { PageProps } from './props';

export default function FormsPage({ role, param }: PageProps) {
  const { show } = useToast();
  const { profile } = useAuth();
  const { settings, categories, classes, students, studentOf, classOf, violationOf, categoryOf } = useDiscipline();
  const [docType, setDocType] = useState(param?.doctype ?? (param?.summons ? 'summons' : param?.referral ? 'referral_memo' : param?.student && !param?.incident ? 'student_ledger' : 'incident_record'));
  const [studentId, setStudentId] = useState<string | null>(param?.student ?? null);
  const [incidentId, setIncidentId] = useState(param?.incident ?? '');
  const [referralId, setReferralId] = useState(param?.referral ?? '');
  const [summonsId, setSummonsId] = useState(param?.summons ?? '');
  const [classId, setClassId] = useState('');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [actions, setActions] = useState<IncidentAction[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [summonsList, setSummonsList] = useState<Summons[]>([]);
  const [saved, setSaved] = useState<DocRow | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [model, setModel] = useState<DocModel | null>(null);

  const spec = DOC_TYPES.find((d) => d.key === docType)!;

  // إن فُتح من واقعة/إحالة دون طالب، استنتج الطالب
  useEffect(() => {
    if (studentId || (!incidentId && !referralId)) return;
    (async () => {
      if (incidentId) {
        const { data } = await supabase.from('incidents').select('student_id').eq('id', incidentId).maybeSingle();
        if (data) setStudentId(data.student_id);
      }
    })();
  }, [incidentId, referralId, studentId]);

  const loadStudentData = useCallback(async () => {
    if (!studentId) {
      setIncidents([]); setActions([]); setReferrals([]); setSummonsList([]);
      return;
    }
    const [i, r, s] = await Promise.all([
      supabase.from('incidents').select('*').eq('student_id', studentId).order('incident_date', { ascending: false }),
      supabase.from('committee_referrals').select('*').eq('student_id', studentId),
      supabase.from('guardian_summons').select('*').eq('student_id', studentId),
    ]);
    const inc = (i.data ?? []) as Incident[];
    setIncidents(inc);
    setReferrals((r.data ?? []) as Referral[]);
    setSummonsList((s.data ?? []) as Summons[]);
    if (inc.length) {
      const { data } = await supabase.from('incident_actions').select('*').in('incident_id', inc.map((x) => x.id)).order('action_no');
      setActions((data ?? []) as IncidentAction[]);
    } else setActions([]);
  }, [studentId]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  const loadDocs = useCallback(async () => {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(30);
    setDocs((data ?? []) as DocRow[]);
  }, []);
  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // إعادة البناء عند تغيير الاختيار
  useEffect(() => {
    // المستند المحفوظ يبقى معروضًا ما دام الاختيار مطابقًا له
    setSaved((cur) =>
      cur && cur.doc_type === docType && (cur.student_id ?? null) === studentId && (cur.incident_id ?? '') === incidentId &&
      (cur.referral_id ?? '') === referralId && (cur.summons_id ?? '') === summonsId
        ? cur
        : null
    );
    (async () => {
      const student = studentOf(studentId);
      const incident = incidents.find((i) => i.id === incidentId);
      const violation = violationOf(incident?.violation_id);
      const ctx: DocCtx = {
        student,
        cls: classOf(student?.class_id),
        incident,
        violation,
        category: categoryOf(violation?.category_id),
        actions: actions.filter((a) => a.incident_id === incidentId),
        referral: referrals.find((r) => r.id === referralId),
        summons: summonsList.find((s) => s.id === summonsId),
        fmt: fmtDate,
        categories,
      };
      if (docType === 'student_ledger') {
        ctx.studentIncidents = incidents.map((i) => {
          const v = violationOf(i.violation_id);
          return { incident: i, violation: v, category: categoryOf(v?.category_id), actions: actions.filter((a) => a.incident_id === i.id) };
        });
      }
      if (docType === 'class_report' && classId) {
        const classStudents = students.filter((s) => s.class_id === classId);
        const { data } = await supabase.from('incidents').select('student_id,violation_id').in('student_id', classStudents.map((s) => s.id));
        ctx.className = classOf(classId)?.name;
        ctx.classRows = classStudents.map((s) => {
          const mine = (data ?? []).filter((x: { student_id: string }) => x.student_id === s.id);
          const counts = categories.map((c) => mine.filter((x: { violation_id: string }) => violationOf(x.violation_id)?.category_id === c.id).length);
          return { student: s, counts, total: mine.length };
        }).filter((r) => r.total > 0);
      }
      setModel(buildDoc(docType, ctx));
    })();
  }, [docType, studentId, incidentId, referralId, summonsId, classId, incidents, actions, referrals, summonsList, students, categories, studentOf, classOf, violationOf, categoryOf]);

  const ready = useMemo(() => {
    if (spec.needs.includes('class')) return !!classId;
    if (spec.needs.includes('student') && !spec.needs.includes('incident')) return !!studentId;
    if (spec.needs.includes('referral')) return !!referralId;
    if (spec.needs.includes('incident')) return !!incidentId;
    return true;
  }, [spec, classId, studentId, incidentId, referralId]);

  async function saveDoc() {
    if (!model || !ready) return show('أكمل اختيار بيانات المستند أولًا', 'warning');
    const { data, error } = await supabase.from('documents').insert({
      doc_type: docType,
      student_id: studentId,
      incident_id: incidentId || null,
      referral_id: referralId || null,
      summons_id: summonsId || null,
      status: 'draft',
      content: { model },
    }).select('*').single();
    if (error) return show(dbError(error), 'error');
    setSaved(data as DocRow);
    loadDocs();
    show(`تم إنشاء المستند ${data.doc_no} (مسودة)`, 'success');
  }

  async function approveDoc() {
    if (!saved) return;
    const { data, error } = await supabase.from('documents')
      .update({ status: 'approved', approved_by: (await supabase.auth.getUser()).data.user?.id, approved_at: new Date().toISOString() })
      .eq('id', saved.id).select('*').single();
    if (error) return show(dbError(error), 'error');
    setSaved(data as DocRow);
    loadDocs();
    show('تم اعتماد المستند', 'success');
  }

  async function print() {
    if (!saved) return show('احفظ المستند أولًا ليحصل على رقم فريد قبل الطباعة', 'warning');
    await logEvent('PRINT', `طباعة المستند ${saved.doc_no} (${docType})`, { name: profile?.full_name, role }, 'documents', saved.id);
    window.print();
  }

  const shown: DocModel | null = saved ? ((saved.content as { model?: DocModel }).model ?? model) : model;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 fade-in">
      <PageTitle icon={<Printer className="w-6 h-6" />} title="النماذج والمستندات" sub="نماذج داخلية بصيغة A4؛ استخدم «طباعة» ثم اختر «حفظ بصيغة PDF» من نافذة الطباعة" />

      <div className="card mb-4 space-y-3 no-print">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="نوع النموذج">
            <select className="input-field" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </Field>
          {spec.needs.includes('class') ? (
            <Field label="الفصل">
              <select className="input-field" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">اختر الفصل</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          ) : (
            <StudentPicker value={studentId} onChange={(id) => { setStudentId(id); setIncidentId(''); setReferralId(''); setSummonsId(''); }} />
          )}
        </div>
        {spec.needs.includes('incident') && studentId && (
          <Field label="الواقعة">
            <select className="input-field" value={incidentId} onChange={(e) => setIncidentId(e.target.value)}>
              <option value="">اختر الواقعة</option>
              {incidents.map((i) => <option key={i.id} value={i.id}>{i.ref_no} — {fmtDate(i.incident_date)} — {violationOf(i.violation_id)?.official_name}</option>)}
            </select>
          </Field>
        )}
        {docType === 'summons' && studentId && (
          <Field label="الاستدعاء">
            <select className="input-field" value={summonsId} onChange={(e) => setSummonsId(e.target.value)}>
              <option value="">اختر الاستدعاء</option>
              {summonsList.map((s) => <option key={s.id} value={s.id}>{s.summons_no} — {s.reason}</option>)}
            </select>
          </Field>
        )}
        {spec.needs.includes('referral') && studentId && (
          <Field label="الإحالة">
            <select className="input-field" value={referralId} onChange={(e) => { setReferralId(e.target.value); const r = referrals.find((x) => x.id === e.target.value); if (r) setIncidentId(r.incident_id); }}>
              <option value="">اختر الإحالة</option>
              {referrals.map((r) => <option key={r.id} value={r.id}>{r.referral_no} — {fmtDate(r.referred_on)}</option>)}
            </select>
          </Field>
        )}
        <div className="flex flex-wrap gap-2 items-center">
          {!saved ? (
            can.write(role) && <button className="btn-primary" onClick={saveDoc} disabled={!ready}><Save className="w-4 h-4" /> إنشاء المستند (مسودة برقم فريد)</button>
          ) : (
            <>
              <Badge tone={saved.status === 'approved' ? 'green' : 'amber'}>{saved.doc_no} — {saved.status === 'approved' ? 'معتمد' : 'مسودة'}</Badge>
              {saved.status === 'draft' && can.approve(role) && (
                <button className="btn-success" onClick={approveDoc}><CheckCircle2 className="w-4 h-4" /> اعتماد المستند</button>
              )}
            </>
          )}
          <button className="btn-secondary" onClick={print} disabled={!saved}><Printer className="w-4 h-4" /> طباعة / حفظ PDF</button>
        </div>
        {!ready && <Notice tone="blue">اختر البيانات المطلوبة أعلاه لتظهر المعاينة المكتملة.</Notice>}
      </div>

      {shown && (
        <DocView
          model={shown}
          settings={settings}
          docNo={saved?.doc_no}
          createdAt={saved ? fmtDate(saved.created_at) : undefined}
          approved={saved?.status === 'approved'}
        />
      )}

      {docs.length > 0 && (
        <div className="card mt-6 no-print">
          <h3 className="font-bold mb-2">آخر المستندات المنشأة</h3>
          <ul className="text-sm space-y-1">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap gap-2 items-center">
                <button className="text-blue-700 underline" onClick={() => {
                  setDocType(d.doc_type);
                  setStudentId(d.student_id);
                  setIncidentId(d.incident_id ?? '');
                  setReferralId(d.referral_id ?? '');
                  setSummonsId(d.summons_id ?? '');
                  setSaved(d);
                }}>{d.doc_no}</button>
                <span>{DOC_TYPES.find((t) => t.key === d.doc_type)?.label}</span>
                <span className="text-gray-500">{studentOf(d.student_id)?.name}</span>
                <Badge tone={d.status === 'approved' ? 'green' : 'amber'}>{d.status === 'approved' ? 'معتمد' : 'مسودة'}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
