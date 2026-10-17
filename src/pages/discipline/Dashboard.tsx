import { useMemo } from 'react';
import { LayoutDashboard, FilePlus2 } from 'lucide-react';
import { useDiscipline } from '@/lib/discipline/data';
import { useRecords } from '@/lib/discipline/records';
import { can } from '@/lib/discipline/constants';
import { addWorkdays, deadlineState } from '@/lib/discipline/workdays';
import { Notice, PageTitle, today } from '@/components/discipline/ui';
import type { PageProps } from './props';

function Stat({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  return (
    <button className="stat-card text-right" onClick={onClick} disabled={!onClick}>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </button>
  );
}

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="text-sm text-gray-500">لا توجد بيانات.</p>;
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-sm">
          <span className="w-32 truncate text-gray-700">{d.label}</span>
          <div className="flex-1 bg-gray-100 rounded h-3">
            <div className="bg-gray-600 h-3 rounded" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-8 text-left font-semibold">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ role, onNavigate }: PageProps) {
  const { categories, studentOf, classOf, violationOf, settings, calendar } = useDiscipline();
  const { incidents, actions, summons, referrals, loading, error } = useRecords();
  const t = today();

  const stats = useMemo(() => {
    const byCat = categories.map((c) => ({
      label: `${c.symbol} ${c.name}`,
      value: incidents.filter((i) => violationOf(i.violation_id)?.category_id === c.id).length,
    }));
    const byClass = new Map<string, number>();
    const byMonth = new Map<string, number>();
    for (const i of incidents) {
      const cn = classOf(studentOf(i.student_id)?.class_id)?.name ?? 'غير محدد';
      byClass.set(cn, (byClass.get(cn) ?? 0) + 1);
      const m = i.incident_date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
    }
    const overdue = actions.filter((a) => a.followup_due && a.followup_due < t && !a.followup_result);
    const alerts: { text: string; level: 'amber' | 'red' }[] = [];
    for (const r of referrals) {
      if (r.status === 'closed') continue;
      if (!r.recommendation_date) {
        const due = addWorkdays(r.referred_on, settings.committee_recommendation_days, calendar);
        const s = deadlineState(due, t, calendar);
        if (s !== 'ok') alerts.push({ text: `الإحالة ${r.referral_no}: موعد رفع التوصية ${due}`, level: s === 'overdue' ? 'red' : 'amber' });
      }
      if (r.decision_date && !r.guardian_notified_on) {
        const due = addWorkdays(r.decision_date, settings.guardian_notice_days, calendar);
        const s = deadlineState(due, t, calendar);
        if (s !== 'ok') alerts.push({ text: `الإحالة ${r.referral_no}: موعد إخطار ولي الأمر ${due}`, level: s === 'overdue' ? 'red' : 'amber' });
      }
    }
    return {
      byCat,
      byClass: [...byClass].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      byMonth: [...byMonth].map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label)),
      overdue, alerts,
    };
  }, [incidents, actions, referrals, categories, classOf, studentOf, violationOf, settings, calendar, t]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 fade-in">
      <PageTitle
        icon={<LayoutDashboard className="w-6 h-6" />}
        title="لوحة متابعة المخالفات"
        sub={[settings.academic_year, settings.term].filter(Boolean).join(' — ') || undefined}
        actions={can.write(role) && (
          <button className="btn-primary" onClick={() => onNavigate('d-new')}>
            <FilePlus2 className="w-4 h-4" /> تسجيل مخالفة جديدة
          </button>
        )}
      />
      {error && <Notice tone="red">{error}</Notice>}
      {loading ? (
        <p className="text-gray-500">جارٍ التحميل...</p>
      ) : (
        <div className="space-y-5">
          {!settings.periods_verified && (
            <Notice>المدد النظامية (التوصية، الإخطار، التظلم) مأخوذة من ملخص اللائحة ولم تُطابق مع النص الرسمي؛ راجعها من «الإعدادات».</Notice>
          )}
          {stats.alerts.length > 0 && (
            <div className="space-y-2">
              {stats.alerts.map((a, i) => <Notice key={i} tone={a.level === 'red' ? 'red' : 'amber'}>{a.text}</Notice>)}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="الوقائع المسجلة" value={incidents.length} onClick={() => onNavigate('d-incidents')} />
            <Stat label="التعهدات المسجلة" value={actions.filter((a) => a.action_type === 'pledge').length} onClick={() => onNavigate('d-actions')} />
            <Stat label="استدعاءات أولياء الأمور" value={summons.length} onClick={() => onNavigate('d-summons')} />
            <Stat label="إجراءات متأخرة عن المتابعة" value={stats.overdue.length} onClick={() => onNavigate('d-actions')} />
            <Stat label="الإحالات المفتوحة" value={referrals.filter((r) => r.status !== 'closed').length} onClick={() => onNavigate('d-committee')} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card"><h2 className="font-bold mb-3">المخالفات حسب الفئة</h2><Bars data={stats.byCat} /></div>
            <div className="card"><h2 className="font-bold mb-3">المخالفات حسب الفصل</h2><Bars data={stats.byClass} /></div>
            <div className="card md:col-span-2"><h2 className="font-bold mb-3">التوزيع الشهري</h2><Bars data={stats.byMonth} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
