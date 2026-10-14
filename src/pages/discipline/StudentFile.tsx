import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderOpen, Printer, FilePlus2, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useDiscipline } from '@/lib/discipline/data';
import { ACTION_LABELS, APPROVAL_LABELS, INCIDENT_STATUS_LABELS, can, pledgeLabel } from '@/lib/discipline/constants';
import type { Incident, IncidentAction, Referral, Summons } from '@/lib/discipline/types';
import type { AttendanceRow } from '@/lib/types';
import { Badge, CategoryBadge, Field, Modal, Notice, PageTitle, StudentPicker, dbError, fmtDate } from '@/components/discipline/ui';
import IncidentDetail from './IncidentDetail';
import type { PageProps } from './props';

export default function StudentFile({ role, onNavigate, param, searchMode }: PageProps & { searchMode?: boolean }) {
  const { show } = useToast();
  const { studentOf, classOf, violationOf, categories, reload: reloadRef } = useDiscipline();
  const [studentId, setStudentId] = useState<string | null>(param?.student ?? null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [actions, setActions] = useState<IncidentAction[]>([]);
  const [summons, setSummons] = useState<Summons[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState('');
  const [asc, setAsc] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!studentId) return;
    const [i, s, r, a] = await Promise.all([
      supabase.from('incidents').select('*').eq('student_id', studentId),
      supabase.from('guardian_summons').select('*').eq('student_id', studentId),
      supabase.from('committee_referrals').select('*').eq('student_id', studentId),
      supabase.from('attendance').select('*').eq('student_id', studentId).order('date', { ascending: false }),
    ]);
    const inc = (i.data ?? []) as Incident[];
    setIncidents(inc);
    setSummons((s.data ?? []) as Summons[]);
    setReferrals((r.data ?? []) as Referral[]);
    setAttendance((a.data ?? []) as AttendanceRow[]);
    if (inc.length) {
      const { data } = await supabase.from('incident_actions').select('*').in('incident_id', inc.map((x) => x.id));
      setActions((data ?? []) as IncidentAction[]);
    } else {
      setActions([]);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const student = studentOf(studentId);
  const cls = classOf(student?.class_id);

  const sorted = useMemo(() => {
    const list = incidents.filter((i) => !catFilter || String(violationOf(i.violation_id)?.category_id) === catFilter);
    return list.sort((a, b) => {
      const k = (x: Incident) => x.incident_date + x.incident_time;
      return asc ? k(a).localeCompare(k(b)) : k(b).localeCompare(k(a));
    });
  }, [incidents, catFilter, asc, violationOf]);

  const att = useMemo(() => {
    const present = attendance.filter((a) => a.status === 'حاضر').length;
    const excused = attendance.filter((a) => a.status === 'غائب بعذر');
    const unexcused = attendance.filter((a) => a.status === 'غائب بلا عذر');
    return { present, excused: excused.length, unexcused, total: attendance.length };
  }, [attendance]);

  const registeredDates = new Set(incidents.map((i) => i.source_attendance_date).filter(Boolean));
  const unfinished = actions.filter((a) => a.approval_status !== 'approved' || (a.followup_due && !a.followup_result));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 fade-in">
      <PageTitle
        icon={<FolderOpen className="w-6 h-6" />}
        title={searchMode ? 'البحث عن طالب' : 'ملف الطالب السلوكي'}
        actions={student && (
          <>
            {can.write(role) && (
              <button className="btn-primary" onClick={() => onNavigate('d-new', { student: student.id })}>
                <FilePlus2 className="w-4 h-4" /> تسجيل مخالفة
              </button>
            )}
            <button className="btn-secondary" onClick={() => onNavigate('d-forms', { student: student.id })}>
              <Printer className="w-4 h-4" /> سجل المخالفات الفردي
            </button>
          </>
        )}
      />

      <div className="card mb-4 no-print">
        <StudentPicker value={studentId} onChange={setStudentId} label="اختر الطالب" />
      </div>

      {!student ? (
        <div className="card text-center text-gray-500">اختر طالبًا لعرض ملفه السلوكي.</div>
      ) : (
        <div className="space-y-4">
          <div className="card">
            <div className="flex justify-between items-start gap-3">
              <div className="text-sm space-y-1">
                <h2 className="text-lg font-bold">{student.name}</h2>
                <p>الرقم المدرسي: {student.school_number || 'غير مسجل'}</p>
                <p>المرحلة: {cls?.stage || 'غير محددة'} — الصف: {cls?.grade_level || 'غير محدد'} — الفصل: {cls?.name}</p>
                <p>ولي الأمر: {student.guardian_name || 'غير مسجل'} — {student.guardian_phone || 'لا يوجد رقم'}</p>
              </div>
              {can.write(role) && (
                <button className="btn-secondary no-print" onClick={() => setEditing(true)}><Pencil className="w-4 h-4" /> تعديل البيانات</button>
              )}
            </div>
          </div>

          {/* ملخص الفئات */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map((c) => (
              <div key={c.id} className="stat-card" style={{ borderRightWidth: 4, borderRightColor: c.color }}>
                <p className="text-2xl font-bold">{incidents.filter((i) => violationOf(i.violation_id)?.category_id === c.id).length}</p>
                <p className="text-sm text-gray-600">{c.symbol} {c.name}</p>
              </div>
            ))}
          </div>

          {/* الحضور */}
          <div className="card">
            <h3 className="font-bold mb-2">الحضور والغياب (من سجل الحضور)</h3>
            <p className="text-sm text-gray-700">
              أيام مسجلة: {att.total} — حضور: {att.present} — غياب بعذر: {att.excused} — غياب بلا عذر: {att.unexcused.length}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ملاحظة: البرنامج الحالي لا يسجل «التأخر» كحالة مستقلة، لذا لا تتوفر أعداد مرات التأخر. الغياب بعذر لا يُعد مخالفة، وتسجيل الغياب بلا عذر كواقعة يتم يدويًا بعد التحقق من شروط اللائحة.
            </p>
            {att.unexcused.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold">أيام الغياب بلا عذر ({att.unexcused.length})</summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {att.unexcused.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <span>{fmtDate(a.date)}</span>
                      {a.note && <span className="text-gray-500">({a.note})</span>}
                      {registeredDates.has(a.date) ? (
                        <Badge tone="green">سُجلت كواقعة</Badge>
                      ) : (
                        can.write(role) && (
                          <button
                            className="btn-secondary !py-0.5 !px-2 text-xs"
                            onClick={() => onNavigate('d-new', { student: student.id, date: a.date, status: a.status })}
                          >
                            مراجعة وتسجيل واقعة
                          </button>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {unfinished.length > 0 && (
            <Notice tone="amber">إجراءات لم تكتمل: {unfinished.length} (غير معتمدة أو بانتظار نتيجة المتابعة).</Notice>
          )}

          {/* السجل الزمني */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 no-print">
              <h3 className="font-bold">السجل الزمني للوقائع ({sorted.length})</h3>
              <div className="flex gap-2">
                <select className="input-field !w-auto" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                  <option value="">كل الفئات</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.symbol} {c.name}</option>)}
                </select>
                <button className="btn-secondary" onClick={() => setAsc(!asc)}>{asc ? 'الأقدم أولًا' : 'الأحدث أولًا'}</button>
              </div>
            </div>
            {sorted.length === 0 && <p className="text-gray-500 text-sm">لا توجد وقائع مسجلة.</p>}
            <div className="space-y-3">
              {sorted.map((i) => {
                const v = violationOf(i.violation_id);
                const acts = actions.filter((a) => a.incident_id === i.id).sort((a, b) => a.action_no - b.action_no);
                const ref = referrals.filter((r) => r.incident_id === i.id);
                const sm = summons.filter((s) => s.incident_id === i.id);
                return (
                  <div key={i.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                    <div className="flex flex-wrap gap-2 items-center">
                      <b>{fmtDate(i.incident_date)}</b>
                      <span className="font-mono text-xs">{i.ref_no}</span>
                      {v && <CategoryBadge id={v.category_id} />}
                      <Badge tone="blue">{INCIDENT_STATUS_LABELS[i.status]}</Badge>
                      <button className="text-blue-700 underline text-xs no-print" onClick={() => setOpenId(i.id)}>تفاصيل</button>
                    </div>
                    <p className="mt-1 font-semibold">{v?.code} — {v?.official_name}</p>
                    <p className="text-gray-700">{i.description}</p>
                    {acts.length > 0 && (
                      <ul className="mt-2 pr-4 list-disc text-gray-700">
                        {acts.map((a) => (
                          <li key={a.id}>
                            {ACTION_LABELS[a.action_type]} {a.pledge_no ? `(${pledgeLabel(a.pledge_no)})` : ''} — {fmtDate(a.action_date)} — {APPROVAL_LABELS[a.approval_status]}
                            {a.followup_result ? ` — المتابعة: ${a.followup_result}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    {sm.map((s) => <p key={s.id} className="text-gray-600">استدعاء {s.summons_no}: {s.reason}</p>)}
                    {ref.map((r) => (
                      <p key={r.id} className="text-gray-600">
                        إحالة {r.referral_no} — {r.final_decision ? `القرار: ${r.final_decision}` : 'لم يصدر قرار'}
                      </p>
                    ))}
                    {i.professional_notes && <p className="text-xs text-gray-500 mt-1">ملاحظات مهنية: {i.professional_notes}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {openId && <IncidentDetail incidentId={openId} role={role} onNavigate={onNavigate} onClose={() => setOpenId(null)} onChanged={load} />}
      {editing && student && (
        <EditStudent
          student={student}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await reloadRef();
            show('تم حفظ بيانات الطالب', 'success');
          }}
        />
      )}
    </div>
  );
}

function EditStudent({ student, onClose, onSaved }: { student: { id: string; school_number: string | null; guardian_name: string | null; guardian_phone: string | null }; onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const [f, setF] = useState({
    school_number: student.school_number ?? '',
    guardian_name: student.guardian_name ?? '',
    guardian_phone: student.guardian_phone ?? '',
  });
  async function save() {
    const { error } = await supabase
      .from('students')
      .update({
        school_number: f.school_number.trim() || null,
        guardian_name: f.guardian_name.trim() || null,
        guardian_phone: f.guardian_phone.trim() || null,
      })
      .eq('id', student.id);
    if (error) return show(dbError(error), 'error');
    onSaved();
  }
  return (
    <Modal title="بيانات الطالب الإضافية" onClose={onClose}>
      <div className="space-y-3">
        <Field label="الرقم المدرسي"><input className="input-field" value={f.school_number} onChange={(e) => setF({ ...f, school_number: e.target.value })} /></Field>
        <Field label="اسم ولي الأمر"><input className="input-field" value={f.guardian_name} onChange={(e) => setF({ ...f, guardian_name: e.target.value })} /></Field>
        <Field label="هاتف ولي الأمر"><input className="input-field" dir="ltr" value={f.guardian_phone} onChange={(e) => setF({ ...f, guardian_phone: e.target.value })} /></Field>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" onClick={save}>حفظ</button>
        </div>
      </div>
    </Modal>
  );
}
