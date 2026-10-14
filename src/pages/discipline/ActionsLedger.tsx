import { useMemo, useState } from 'react';
import { Gavel } from 'lucide-react';
import { useDiscipline } from '@/lib/discipline/data';
import { useRecords } from '@/lib/discipline/records';
import { ACTION_LABELS, APPROVAL_LABELS, pledgeLabel } from '@/lib/discipline/constants';
import type { ActionType, ApprovalStatus } from '@/lib/discipline/types';
import { Badge, PageTitle, fmtDate, today } from '@/components/discipline/ui';
import IncidentDetail from './IncidentDetail';
import type { PageProps } from './props';

// سجل مستقل بجميع الإجراءات والتعهدات؛ تُضاف الإجراءات من داخل الواقعة لضمان ارتباطها بها
export default function ActionsLedger({ role, onNavigate }: PageProps) {
  const { studentOf, violationOf } = useDiscipline();
  const { incidents, actions, loading, reload } = useRecords();
  const [type, setType] = useState<ActionType | ''>('');
  const [approval, setApproval] = useState<ApprovalStatus | ''>('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const incMap = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents]);
  const rows = actions.filter(
    (a) =>
      (!type || a.action_type === type) &&
      (!approval || a.approval_status === approval) &&
      (!onlyOverdue || (a.followup_due && a.followup_due < today() && !a.followup_result))
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 fade-in">
      <PageTitle icon={<Gavel className="w-6 h-6" />} title="الإجراءات والتعهدات" sub="لتسجيل إجراء جديد افتح الواقعة من سجل المخالفات ثم «إضافة إجراء»" />
      <div className="card mb-4 grid sm:grid-cols-4 gap-3 no-print">
        <select className="input-field" value={type} onChange={(e) => setType(e.target.value as ActionType | '')}>
          <option value="">كل أنواع الإجراءات</option>
          {(Object.keys(ACTION_LABELS) as ActionType[]).map((k) => <option key={k} value={k}>{ACTION_LABELS[k]}</option>)}
        </select>
        <select className="input-field" value={approval} onChange={(e) => setApproval(e.target.value as ApprovalStatus | '')}>
          <option value="">كل حالات الاعتماد</option>
          {(Object.keys(APPROVAL_LABELS) as ApprovalStatus[]).map((k) => <option key={k} value={k}>{APPROVAL_LABELS[k]}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
          المتأخرة عن المتابعة فقط
        </label>
        <button className="btn-secondary" onClick={() => onNavigate('d-incidents')}>الانتقال إلى سجل الوقائع</button>
      </div>

      {loading ? (
        <p className="text-gray-500">جارٍ التحميل...</p>
      ) : rows.length === 0 ? (
        <div className="card text-center text-gray-500">لا توجد إجراءات مطابقة.</div>
      ) : (
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">الطالب</th>
                <th className="p-2 text-right">الإجراء</th>
                <th className="p-2 text-right">الواقعة</th>
                <th className="p-2 text-right">الاعتماد</th>
                <th className="p-2 text-right">المتابعة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const inc = incMap.get(a.incident_id);
                const overdue = a.followup_due && a.followup_due < today() && !a.followup_result;
                return (
                  <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setOpenId(a.incident_id)}>
                    <td className="p-2">{fmtDate(a.action_date)}</td>
                    <td className="p-2 font-semibold">{studentOf(inc?.student_id)?.name}</td>
                    <td className="p-2">
                      {ACTION_LABELS[a.action_type]} {a.pledge_no ? <Badge tone="amber">{pledgeLabel(a.pledge_no)}</Badge> : null}
                    </td>
                    <td className="p-2 text-xs">{inc?.ref_no} — {violationOf(inc?.violation_id)?.official_name}</td>
                    <td className="p-2"><Badge tone={a.approval_status === 'approved' ? 'green' : 'gray'}>{APPROVAL_LABELS[a.approval_status]}</Badge></td>
                    <td className="p-2">
                      {a.followup_due ? (overdue ? <Badge tone="red">متأخرة منذ {fmtDate(a.followup_due)}</Badge> : fmtDate(a.followup_due)) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {openId && <IncidentDetail incidentId={openId} role={role} onNavigate={onNavigate} onClose={() => setOpenId(null)} onChanged={reload} />}
    </div>
  );
}
