import { useMemo, useState } from 'react';
import { ListChecks, FilePlus2 } from 'lucide-react';
import { useDiscipline } from '@/lib/discipline/data';
import { useRecords } from '@/lib/discipline/records';
import { INCIDENT_STATUS_LABELS, INCIDENT_STATUS_ORDER, can } from '@/lib/discipline/constants';
import type { IncidentStatus } from '@/lib/discipline/types';
import { Badge, CategoryBadge, PageTitle, fmtDate } from '@/components/discipline/ui';
import IncidentDetail from './IncidentDetail';
import type { PageProps } from './props';

export default function IncidentsList({ role, onNavigate, param }: PageProps) {
  const { studentOf, classOf, violationOf, categories, classes } = useDiscipline();
  const { incidents, loading, error, reload } = useRecords();
  const [openId, setOpenId] = useState<string | null>(param?.open ?? null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<IncidentStatus | ''>('');
  const [cat, setCat] = useState('');
  const [cls, setCls] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const rows = useMemo(() => {
    return incidents.filter((i) => {
      const st = studentOf(i.student_id);
      const v = violationOf(i.violation_id);
      if (q && !(st?.name.includes(q) || (st?.school_number ?? '').includes(q) || i.ref_no.includes(q) || v?.official_name.includes(q) || v?.code.includes(q))) return false;
      if (status && i.status !== status) return false;
      if (cat && String(v?.category_id) !== cat) return false;
      if (cls && st?.class_id !== cls) return false;
      if (from && i.incident_date < from) return false;
      if (to && i.incident_date > to) return false;
      return true;
    });
  }, [incidents, q, status, cat, cls, from, to, studentOf, violationOf]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 fade-in">
      <PageTitle
        icon={<ListChecks className="w-6 h-6" />}
        title="سجل جميع المخالفات"
        sub={`${rows.length} من ${incidents.length} واقعة`}
        actions={can.write(role) && (
          <button className="btn-primary" onClick={() => onNavigate('d-new')}>
            <FilePlus2 className="w-4 h-4" /> تسجيل مخالفة جديدة
          </button>
        )}
      />

      <div className="card mb-4 grid sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
        <input className="input-field lg:col-span-2" placeholder="بحث: اسم الطالب، رقم مدرسي، رقم مرجعي، مخالفة" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus | '')}>
          <option value="">كل الحالات</option>
          {INCIDENT_STATUS_ORDER.map((s) => <option key={s} value={s}>{INCIDENT_STATUS_LABELS[s]}</option>)}
        </select>
        <select className="input-field" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">كل الفئات</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.symbol} {c.name}</option>)}
        </select>
        <select className="input-field" value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="">كل الفصول</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-2 lg:col-span-1">
          <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="من تاريخ" />
          <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} aria-label="إلى تاريخ" />
        </div>
      </div>

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {loading ? (
        <p className="text-gray-500">جارٍ التحميل...</p>
      ) : rows.length === 0 ? (
        <div className="card text-center text-gray-500">لا توجد وقائع مطابقة.</div>
      ) : (
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-2 text-right">الرقم</th>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">الطالب</th>
                <th className="p-2 text-right">الفصل</th>
                <th className="p-2 text-right">المخالفة</th>
                <th className="p-2 text-right">الفئة</th>
                <th className="p-2 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const v = violationOf(i.violation_id);
                return (
                  <tr key={i.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setOpenId(i.id)}>
                    <td className="p-2 font-mono text-xs">{i.ref_no}</td>
                    <td className="p-2">{fmtDate(i.incident_date)}</td>
                    <td className="p-2 font-semibold">{studentOf(i.student_id)?.name}</td>
                    <td className="p-2">{classOf(studentOf(i.student_id)?.class_id)?.name}</td>
                    <td className="p-2">{v?.code} {v?.official_name}</td>
                    <td className="p-2">{v && <CategoryBadge id={v.category_id} />}</td>
                    <td className="p-2"><Badge tone="blue">{INCIDENT_STATUS_LABELS[i.status]}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <IncidentDetail incidentId={openId} role={role} onNavigate={onNavigate} onClose={() => setOpenId(null)} onChanged={reload} />
      )}
    </div>
  );
}
