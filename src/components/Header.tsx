import { useState } from 'react';
import { ChevronDown, KeyRound, LogOut, Menu, X } from 'lucide-react';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { useAuth } from '@/lib/discipline/auth';
import { ROLE_LABELS } from '@/lib/discipline/constants';
import type { Role } from '@/lib/discipline/types';
import { NAV_GROUPS, canOpenPage, isDisciplinePage, type NavItem, type PageKey } from '@/lib/nav';

type HeaderProps = {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
};

const COLLAPSED_KEY = 'sidebar-collapsed-groups';

function loadCollapsed(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export default function Header({ currentPage, onNavigate, mobileMenuOpen, setMobileMenuOpen }: HeaderProps) {
  const { profile, realRole, setViewAs, signOut } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const inDiscipline = isDisciplinePage(currentPage);
  const [collapsed, setCollapsed] = useState<string[]>(loadCollapsed);

  function persist(next: string[]) {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {
      /* التخزين المحلي اختياري */
    }
  }

  function toggleGroup(title: string) {
    persist(collapsed.includes(title) ? collapsed.filter((t) => t !== title) : [...collapsed, title]);
  }

  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => canOpenPage(it.key, profile?.role)) }))
    .filter((g) => g.items.length > 0);
  const allCollapsed = collapsed.length === groups.length;
  const currentItem = groups.flatMap((g) => g.items).find((it) => it.key === currentPage);

  function go(key: PageKey) {
    onNavigate(key);
    setMobileMenuOpen(false);
  }

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    const isActive = currentPage === item.key;
    return (
      <button
        key={item.key}
        onClick={() => go(item.key)}
        className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm text-right transition-all ${
          isActive
            ? 'bg-[#CE1126] text-white font-bold shadow-sm'
            : 'text-gray-600 font-semibold hover:bg-gray-100'
        }`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
      </button>
    );
  }

  const sidebarContent = (
    <>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="flex justify-end pb-1">
          <button
            onClick={() => persist(allCollapsed ? [] : groups.map((g) => g.title))}
            className="text-[11px] font-semibold text-gray-500 hover:text-[#CE1126] px-2 py-1"
          >
            {allCollapsed ? 'توسيع الكل' : 'تصغير الكل'}
          </button>
        </div>
        {groups.map((group, gi) => {
          const hasActive = group.items.some((it) => it.key === currentPage);
          const open = hasActive || !collapsed.includes(group.title);
          return (
            <div key={group.title} className={gi > 0 ? 'pt-2 mt-1 border-t border-gray-100' : ''}>
              <button
                onClick={() => toggleGroup(group.title)}
                aria-expanded={open}
                className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-[11px] font-bold text-gray-500 hover:bg-gray-50"
              >
                {group.title}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
              </button>
              {open && <div className="space-y-0.5 mt-0.5">{group.items.map((it) => renderItem(it))}</div>}
            </div>
          );
        })}
      </nav>

      {profile && (
        <div className="border-t border-gray-200 p-3 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#CE1126] text-white flex items-center justify-center font-bold flex-shrink-0">
              {profile.full_name.trim().charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-800 truncate">{profile.full_name}</p>
              {realRole === 'admin' ? (
                <select
                  value={profile.role}
                  onChange={(e) => {
                    setViewAs(e.target.value === 'admin' ? null : (e.target.value as Role));
                    window.location.reload();
                  }}
                  title="تبديل نوع الحساب (وضع المشرف يعرض صفوفك المعيَّنة فقط)"
                  aria-label="نوع الحساب"
                  className={`text-xs rounded border px-1 py-0.5 max-w-full ${
                    profile.role === 'admin' ? 'border-gray-300 text-gray-600 bg-white' : 'border-amber-400 bg-amber-50 text-amber-800 font-semibold'
                  }`}
                >
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-gray-500 truncate">{ROLE_LABELS[profile.role]}</p>
              )}
            </div>
            <button
              onClick={() => setPasswordOpen(true)}
              className="p-2 rounded-lg text-gray-500 hover:text-[#CE1126] hover:bg-white transition-colors"
              title="تغيير كلمة المرور"
              aria-label="تغيير كلمة المرور"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={() => signOut()}
              className="p-2 rounded-lg text-gray-500 hover:text-[#CE1126] hover:bg-white transition-colors"
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
      {/* الترويسة الرسمية تظهر عند طباعة التقارير فقط */}
      {!inDiscipline && (
        <div className="hidden print:block text-center py-3 border-b border-gray-800">
          <p className="text-sm font-semibold">مملكة البحرين</p>
          <p className="text-sm font-semibold">وزارة التربية والتعليم</p>
          <p className="text-base font-bold">مدرسة أحمد الفاتح الإعدادية للبنين</p>
          <p className="text-sm font-bold mt-1">سجل الحضور والغياب الطلابي</p>
        </div>
      )}

      {/* شريط علوي للهاتف */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm flex items-center gap-3 h-14 px-4 no-print">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="القائمة"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-bold text-gray-700 text-sm truncate">{currentItem?.label}</span>
      </div>

      {/* الشريط الجانبي لسطح المكتب */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 sticky top-0 h-screen bg-white border-l border-gray-200 shadow-sm no-print">
        {sidebarContent}
      </aside>

      {/* درج القائمة للهاتف */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 no-print">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute top-0 bottom-0 right-0 w-72 max-w-[85%] bg-white shadow-xl flex flex-col fade-in pt-10">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-2 left-2 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 z-10"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
