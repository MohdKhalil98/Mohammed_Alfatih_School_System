import { useAuth } from '@/lib/discipline/auth';
import { DisciplineDataProvider, useDiscipline } from '@/lib/discipline/data';
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

function Inner({ page, param, onNavigate }: { page: PageKey; param?: Record<string, string>; onNavigate: NavFn }) {
  const { ready, error } = useDiscipline();
  const { profile } = useAuth();

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
      {content}
    </>
  );
}

export default function DisciplineShell({ page, param, onNavigate }: { page: PageKey; param?: Record<string, string>; onNavigate: NavFn }) {
  return (
    <DisciplineDataProvider>
      <Inner page={page} param={param} onNavigate={onNavigate} />
    </DisciplineDataProvider>
  );
}
