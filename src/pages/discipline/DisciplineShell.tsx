import { useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/discipline/auth';
import { DisciplineDataProvider, useDiscipline } from '@/lib/discipline/data';
import { ROLE_LABELS } from '@/lib/discipline/constants';
import type { PageKey } from '@/lib/nav';
import { Notice } from '@/components/discipline/ui';
import Dashboard from './Dashboard';
import NewIncident from './NewIncident';
import IncidentsList from './IncidentsList';
import StudentFile from './StudentFile';
import ActionsLedger from './ActionsLedger';
import SummonsPage from './SummonsPage';
import CommitteePage from './CommitteePage';
import FormsPage from './FormsPage';
import ReportsPage from './ReportsPage';
import CatalogPage from './CatalogPage';
import SettingsPage from './SettingsPage';

import type { NavFn } from './props';

function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(await signIn(email.trim(), password));
    setBusy(false);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10 fade-in">
      <form onSubmit={submit} className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-50 p-2.5 rounded-lg text-[#CE1126]"><ShieldAlert className="w-6 h-6" /></div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">الانضباط الطلابي</h1>
            <p className="text-sm text-gray-500">سجّل الدخول للوصول إلى بيانات الانضباط</p>
          </div>
        </div>
        <label className="block">
          <span className="block text-sm font-semibold mb-1">البريد الإلكتروني</span>
          <input className="input-field" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold mb-1">كلمة المرور</span>
          <input className="input-field" type="password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'جارٍ الدخول...' : 'دخول'}</button>
        <p className="text-xs text-gray-500">أقسام الحضور والغياب لا تتطلب تسجيل الدخول.</p>
      </form>
    </div>
  );
}

function Inner({ page, param, onNavigate }: { page: PageKey; param?: Record<string, string>; onNavigate: NavFn }) {
  const { ready, error } = useDiscipline();
  const { profile, signOut } = useAuth();

  if (!ready) return <p className="p-8 text-center text-gray-500">جارٍ التحميل...</p>;
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Notice tone="red">{error}</Notice>
      </div>
    );
  }

  const role = profile!.role;
  const props = { role, onNavigate, param };
  let content;
  switch (page) {
    case 'd-dashboard': content = <Dashboard {...props} />; break;
    case 'd-new': content = <NewIncident {...props} />; break;
    case 'd-incidents': content = <IncidentsList {...props} />; break;
    case 'd-search': content = <StudentFile {...props} searchMode />; break;
    case 'd-student': content = <StudentFile {...props} />; break;
    case 'd-actions': content = <ActionsLedger {...props} />; break;
    case 'd-summons': content = <SummonsPage {...props} />; break;
    case 'd-committee': content = <CommitteePage {...props} />; break;
    case 'd-forms': content = <FormsPage {...props} />; break;
    case 'd-reports': content = <ReportsPage {...props} />; break;
    case 'd-catalog': content = <CatalogPage {...props} />; break;
    case 'd-settings': content = <SettingsPage {...props} />; break;
    default: content = <Dashboard {...props} />;
  }

  return (
    <>
      <div className="bg-gray-100 border-b border-gray-200 no-print">
        <div className="max-w-6xl mx-auto px-4 py-1.5 flex items-center justify-between text-xs text-gray-600">
          <span>
            {profile!.full_name} — {ROLE_LABELS[role]}
          </span>
          <button className="flex items-center gap-1 hover:text-[#CE1126]" onClick={() => signOut()}>
            <LogOut className="w-3.5 h-3.5" /> تسجيل الخروج
          </button>
        </div>
      </div>
      {content}
    </>
  );
}

export default function DisciplineShell({ page, param, onNavigate }: { page: PageKey; param?: Record<string, string>; onNavigate: NavFn }) {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) return <p className="p-8 text-center text-gray-500">جارٍ التحميل...</p>;
  if (!session) return <Login />;
  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="card space-y-3">
          <Notice tone="amber">
            تم تسجيل الدخول لكن حسابك غير مفعّل لقسم الانضباط. يرجى مراجعة مدير النظام لإضافة صلاحيتك.
          </Notice>
          <button className="btn-secondary" onClick={() => signOut()}>تسجيل الخروج</button>
        </div>
      </div>
    );
  }
  return (
    <DisciplineDataProvider>
      <Inner page={page} param={param} onNavigate={onNavigate} />
    </DisciplineDataProvider>
  );
}
