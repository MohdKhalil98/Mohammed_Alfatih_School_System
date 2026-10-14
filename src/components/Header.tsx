import { useState } from 'react';
import { ShieldAlert, ChevronDown } from 'lucide-react';
import { NAV_ITEMS, DISCIPLINE_ITEMS, isDisciplinePage, type PageKey } from '@/lib/nav';

type HeaderProps = {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
};

export default function Header({ currentPage, onNavigate, mobileMenuOpen, setMobileMenuOpen }: HeaderProps) {
  const [disciplineOpen, setDisciplineOpen] = useState(false);
  const currentItem = [...NAV_ITEMS, ...DISCIPLINE_ITEMS].find((item) => item.key === currentPage);
  const inDiscipline = isDisciplinePage(currentPage);

  return (
    <>
      {/* الترويسة الرسمية */}
      <div className={`bg-gradient-to-l from-[#CE1126] to-[#a00d1f] text-white ${inDiscipline ? 'no-print' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col items-center text-center gap-1">
            <p className="text-xs sm:text-sm font-semibold tracking-wide">مملكة البحرين</p>
            <p className="text-xs sm:text-sm font-semibold tracking-wide">وزارة التربية والتعليم</p>
            <p className="text-sm sm:text-lg font-bold tracking-wide">مدرسة أحمد الفاتح الإعدادية للبنين</p>
            <div className="h-0.5 w-16 bg-white/40 my-1"></div>
            <p className="text-sm sm:text-base font-bold">سجل الحضور والغياب الطلابي</p>
          </div>
        </div>
      </div>

      {/* شريط التنقل */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* زر القائمة للهاتف */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="القائمة"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* العنوان الحالي للهاتف */}
            <span className="lg:hidden font-bold text-gray-700 text-sm">
              {currentItem?.label}
            </span>

            {/* قائمة سطح المكتب */}
            <div className="hidden lg:flex items-center gap-1 flex-1 overflow-x-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-[#CE1126] text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* قسم الانضباط الطلابي (سطح المكتب) */}
            <div className="hidden lg:block relative">
              <button
                onClick={() => setDisciplineOpen(!disciplineOpen)}
                aria-expanded={disciplineOpen}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  inDiscipline ? 'bg-[#CE1126] text-white shadow-sm' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                الانضباط الطلابي
                <ChevronDown className="w-4 h-4" />
              </button>
              {disciplineOpen && (
                <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
                  {DISCIPLINE_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          onNavigate(item.key);
                          setDisciplineOpen(false);
                        }}
                        className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-right ${
                          currentPage === item.key ? 'bg-red-50 text-[#CE1126] font-bold' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* قائمة الهاتف المنسدلة */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white fade-in">
            <div className="px-4 py-2 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      onNavigate(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#CE1126] text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
              <div className="flex items-center gap-2 px-3 pt-3 pb-1 text-xs font-bold text-gray-500 border-t border-gray-100 mt-2">
                <ShieldAlert className="w-4 h-4" />
                الانضباط الطلابي
              </div>
              {DISCIPLINE_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      onNavigate(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      isActive ? 'bg-[#CE1126] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
