import { useState } from 'react';
import Header from '@/components/Header';
import Toast from '@/components/Toast';
import SchoolBanner from '@/components/SchoolBanner';
import { ToastProvider, useToast } from '@/lib/toast';
import { canOpenPage, isDisciplinePage, type PageKey } from '@/lib/nav';
import { AuthProvider, useAuth } from '@/lib/discipline/auth';
import Login from '@/pages/Login';
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
  const { profile } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageKey>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [pageParam, setPageParam] = useState<Record<string, string> | undefined>(undefined);

  function handleNavigate(page: PageKey, param?: Record<string, string>) {
    setCurrentPage(page);
    setPageParam(param);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderPage() {
    if (!canOpenPage(currentPage, profile?.role)) return <Home onNavigate={handleNavigate} />;
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
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
      <SchoolBanner />
      <main className="flex-1">
        {renderPage()}
      </main>
      {/* تذييل الصفحة */}
      <footer className="bg-gray-800 text-gray-300 text-center py-4 text-sm no-print">
        <p>مملكة البحرين - وزارة التربية والتعليم - مدرسة أحمد الفاتح الإعدادية للبنين</p>
        <p className="text-xs text-gray-400 mt-1">سجل الحضور والغياب الطلابي</p>
      </footer>
      </div>
      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function AuthGate() {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">جارٍ التحميل...</div>;
  }
  if (!session) return <Login />;
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="card max-w-md w-full space-y-3 text-center">
          <p className="font-bold text-gray-800">حسابك غير مفعّل</p>
          <p className="text-sm text-gray-600">تم تسجيل الدخول لكن لا توجد صلاحية مفعّلة لحسابك. يرجى مراجعة مدير النظام.</p>
          <button className="btn-secondary" onClick={() => signOut()}>تسجيل الخروج</button>
        </div>
      </div>
    );
  }
  return <AppContent />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ToastProvider>
  );
}
