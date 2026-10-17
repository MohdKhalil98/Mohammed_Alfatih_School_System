// الترويسة الرسمية في أعلى الصفحة (على الشاشة فقط؛ الطباعة لها ترويسة خاصة في Header)
export default function SchoolBanner() {
  return (
    <div className="bg-gradient-to-l from-[#CE1126] to-[#a00d1f] text-white no-print">
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
  );
}
