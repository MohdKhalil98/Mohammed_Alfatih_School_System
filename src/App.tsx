import { useState } from 'react';
import Header from '@/components/Header';
import Toast from '@/components/Toast';
import { ToastProvider, useToast } from '@/lib/toast';
import { isDisciplinePage, type PageKey } from '@/lib/nav';
import { AuthProvider } from '@/lib/discipline/auth';
import DisciplineShell from '@/pages/discipline/DisciplineShell';
import Home from '@/pages/Home';
import Classes from '@/pages/Classes';
import Students from '@/pages/Students';
import Attendance from '@/pages/Attendance';
import DailyReport from '@/pages/DailyReport';
import MonthlyReport from '@/pages/MonthlyReport';
import StudentRecord from '@/pages/StudentRecord';
import Backup from '@/pages/Backup';

function AppContent() {
  const { toasts, dismiss } = useToast();
  const [currentPage, setCurrentPage] = useState<PageKey>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [pageParam, setPageParam] = useState<Record<string, string> | undefined>(undefined);

  function handleNavigate(page: PageKey, param?: Record<string, string>) {
    setCurrentPage(page);
    setPageParam(param);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderPage() {
    if (isDisciplinePage(currentPage)) {
      return <DisciplineShell page={currentPage} param={pageParam} onNavigate={handleNavigate} />;
    }
    switch (currentPage) {
      case 'home':
        return <Home onNavigate={handleNavigate} />;
      case 'classes':
        return <Classes />;
      case 'students':
        return <Students />;
      case 'attendance':
        return <Attendance />;
      case 'daily-report':
        return <DailyReport />;
      case 'monthly-report':
        return <MonthlyReport />;
      case 'student-record':
        return <StudentRecord />;
      case 'backup':
        return <Backup />;
      default:
        return <Home onNavigate={handleNavigate} />;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      <main className="flex-1">
        {renderPage()}
      </main>
      {/* تذييل الصفحة */}
      <footer className="bg-gray-800 text-gray-300 text-center py-4 text-sm no-print">
        <p>مملكة البحرين - وزارة التربية والتعليم - مدرسة أحمد الفاتح الإعدادية للبنين</p>
        <p className="text-xs text-gray-400 mt-1">سجل الحضور والغياب الطلابي</p>
      </footer>
      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
