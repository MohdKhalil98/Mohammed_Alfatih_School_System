import { useMemo, useState } from 'react';
import { BarChart3, FileSpreadsheet, Printer } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/discipline/auth';
import { useDiscipline } from '@/lib/discipline/data';
import { useRecords } from '@/lib/discipline/records';
import { logEvent } from '@/lib/discipline/audit';
import { exportToExcel } from '@/lib/export';
import { ACTION_LABELS, INCIDENT_STATUS_LABELS, INCIDENT_STATUS_ORDER, pledgeLabel } from '@/lib/discipline/constants';
import type { ActionType, IncidentStatus } from '@/lib/discipline/types';
import DocView from '@/components/discipline/DocView';
import { Field, PageTitle, StudentPicker, fmtDate } from '@/components/discipline/ui';
import type { PageProps } from './props';

export default function ReportsPage({ role, onNavigate }: PageProps) {
  const { show } = useToast();
  const { profile } = useAuth();
  const { categories, classes, currentViolations, studentOf, classOf, violationOf, categoryOf, settings } = useDiscipline();
  const { incidents, actions, loading } = useRecords();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [classId, setClassId] = useState('');
  const [cat, setCat] = useState('');
  const [vio, setVio] = useState('');
  const [actionType, setActionType] = useState<ActionType | ''>('');
  const [status, setStatus] = useState<IncidentStatus | ''>('');

  const rows = useMemo(() => {
    return incidents
      .filter((i) => {
        const st = studentOf(i.student_id);
        const v = violationOf(i.violation_id);
        if (from && i.incident_date < from) return false;
        if (to && i.incident_date > to) return false;
        if (studentId && i.student_id !== studentId) return false;
        if (classId && st?.class_id !== classId) return false;
        if (cat && String(v?.category_id) !== cat) return false;
        if (vio && i.violation_id !== vio) return false;
        if (status && i.status !== status) return false;
        if (actionType && !actions.some((a) => a.incident_id === i.id && a.action_type === actionType)) return false;
        return true;
      })
      .map((i) => {
        const st = studentOf(i.student_id);
        const v = violationOf(i.violation_id);
        const acts = actions.filter((a) => a.incident_id === i.id);
        return {
          'الرقم المرجعي': i.ref_no,
          'التاريخ': i.incident_date,
          'الطالب': st?.name ?? '',
          'الرقم المدرسي': st?.school_number ?? '',
          'الصف': classOf(st?.class_id)?.grade_level ?? '',
          'الفصل': classOf(st?.class_id)?.name ?? '',
          'الفئة': categoryOf(v?.category_id)?.name ?? '',
          'رمز المخالفة': v?.code ?? '',
          'المخالفة': v?.official_name ?? '',
          'الحالة': INCIDENT_STATUS_LABELS[i.status],
          'الإجراءات': acts.map((a) => ACTION_LABELS[a.action_type] + (a.pledge_no ? ` (${pledgeLabel(a.pledge_no)})` : '')).join('، '),
        };
      });
  }, [incidents, actions, from, to, studentId, classId, cat, vio, status, actionType, studentOf, classOf, violationOf, categoryOf]);

  async function doExcel() {
    if (rows.length === 0) return show('لا توجد بيانات للتصدير', 'warning');
    exportToExcel(rows, 'المخالفات', `تقرير_المخالفات_${new Date().toISOString().slice(0, 10)}`);
    await logEvent('EXPORT', `تصدير Excel لتقرير المخالفات (${rows.length} سجل)`, { name: profile?.full_name, role });
    show('تم تصدير الملف', 'success');
  }

  async function doPrint() {
    await logEvent('PRINT', `طباعة تقرير المخالفات (${rows.length} سجل)`, { name: profile?.full_name, role });
    window.print();
  }

  const heads = rows.length ? (Object.keys(rows[0]) as (keyof (typeof rows)[number])[]) : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 fade-in">
      <PageTitle
        icon={<BarChart3 className="w-6 h-6" />}
        title="التقارير والإحصاءات"
        sub={`${rows.length} سجل مطابق`}
        actions={
          <>
            <button className="btn-success" onClick={doExcel}><FileSpreadsheet className="w-4 h-4" /> Excel</button>
            <button className="btn-secondary" onClick={doPrint}><Printer className="w-4 h-4" /> طباعة / PDF</button>
            <button className="btn-secondary" onClick={() => onNavigate('d-forms', { doctype: 'class_report' })}>تقرير الفصل</button>
          </>
        }
      />

      <div className="card mb-4 grid sm:grid-cols-3 lg:grid-cols-4 gap-3 no-print">
        <Field label="من تاريخ"><input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="إلى تاريخ"><input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="الصف والفصل">
          <select className="input-field" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">الكل</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="حالة الواقعة">
          <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus | '')}>
            <option value="">الكل</option>
            {INCIDENT_STATUS_ORDER.map((s) => <option key={s} value={s}>{INCIDENT_STATUS_LABELS[s]}</option>)}
          </select>
        </Field>
        <Field label="فئة المخالفة">
          <select className="input-field" value={cat} onChange={(e) => { setCat(e.target.value); setVio(''); }}>
            <option value="">الكل</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.symbol} {c.name}</option>)}
          </select>
        </Field>
        <Field label="نوع المخالفة">
          <select className="input-field" value={vio} onChange={(e) => setVio(e.target.value)}>
            <option value="">الكل</option>
            {currentViolations.filter((v) => !cat || v.category_id === Number(cat)).map((v) => <option key={v.id} value={v.id}>{v.code} {v.official_name}</option>)}
          </select>
        </Field>
        <Field label="نوع الإجراء">
          <select className="input-field" value={actionType} onChange={(e) => setActionType(e.target.value as ActionType | '')}>
            <option value="">الكل</option>
            {(Object.keys(ACTION_LABELS) as ActionType[]).map((k) => <option key={k} value={k}>{ACTION_LABELS[k]}</option>)}
          </select>
        </Field>
        <StudentPicker value={studentId} onChange={setStudentId} />
      </div>

      {loading ? (
        <p className="text-gray-500">جارٍ التحميل...</p>
      ) : (
        <DocView
          model={{
            title: 'تقرير المخالفات الطلابية',
            sections: [
              {
                rows: [
                  ['الفترة', `${from ? fmtDate(from) : 'البداية'} — ${to ? fmtDate(to) : 'اليوم'}`],
                  ['عدد السجلات', String(rows.length)],
                  ['أعدّه', profile?.full_name ?? ''],
                ],
              },
              { table: { head: heads as string[], rows: rows.map((r) => heads.map((h) => String(r[h] ?? ''))) } },
            ],
            signatures: ['المرشد الاجتماعي', 'مدير المدرسة'],
          }}
          settings={settings}
        />
      )}
      <p className="text-xs text-gray-500 mt-2 no-print">التقارير تعرض بيانات الطلاب بالقدر اللازم؛ تُسجَّل عمليات التصدير والطباعة في سجل التدقيق.</p>
    </div>
  );
}
