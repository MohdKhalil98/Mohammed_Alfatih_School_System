import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { ClassRow } from '@/lib/types';
import { formatArabicDateShort, ARABIC_MONTHS, STATUS_COLORS } from '@/lib/types';
import { exportMonthlyReportToExcel, shareViaWhatsApp } from '@/lib/export';
import { CalendarDays, Download, Share2, Printer, BookOpen, AlertCircle, XCircle } from 'lucide-react';

type StudentMonthlyData = {
  student_id: string;
  student_name: string;
  absences: { date: string; status: string; note?: string }[];
  excusedCount: number;
  unexcusedCount: number;
  totalCount: number;
};

export default function MonthlyReport() {
  const { show } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState<StudentMonthlyData[]>([]);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes]);

  useEffect(() => {
    if (selectedClassId) {
      loadReport();
    }
  }, [selectedClassId, selectedYear, selectedMonth]);

  async function loadClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name, order_index, created_at')
      .order('order_index', { ascending: true });
    if (data) setClasses(data);
  }

  async function loadReport() {
    setLoading(true);
    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
    const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    const endDate = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;

    // تحميل طلاب الصف
    const { data: studentsData } = await supabase
      .from('students')
      .select('id, name, class_id')
      .eq('class_id', selectedClassId)
      .order('name', { ascending: true });

    if (!studentsData || studentsData.length === 0) {
      setStudentData([]);
      setLoading(false);
      return;
    }

    // تحميل سجلات الحضور للشهر
    const { data: attData } = await supabase
      .from('attendance')
      .select('id, student_id, class_id, date, status, note')
      .eq('class_id', selectedClassId)
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: true });

    const records = attData || [];

    const data: StudentMonthlyData[] = studentsData.map((student) => {
      const studentAtt = records.filter((r) => r.student_id === student.id);
      const absences = studentAtt
        .filter((r) => r.status !== 'حاضر')
        .map((r) => ({ date: r.date, status: r.status, note: r.note || undefined }));
      return {
        student_id: student.id,
        student_name: student.name,
        absences,
        excusedCount: absences.filter((a) => a.status === 'غائب بعذر').length,
        unexcusedCount: absences.filter((a) => a.status === 'غائب بلا عذر').length,
        totalCount: absences.length,
      };
    });

    setStudentData(data);
    setLoading(false);
  }

  function handlePrint() {
    window.print();
  }

  function handleExportExcel() {
    if (studentData.length === 0) {
      show('لا توجد بيانات للتصدير', 'warning');
      return;
    }
    const className = classes.find((c) => c.id === selectedClassId)?.name || '';
    const monthName = ARABIC_MONTHS[selectedMonth];
    const exportData = studentData.map((s) => ({
      name: s.student_name,
      absences: s.absences.map((a) => ({ date: a.date, status: a.status, note: a.note })),
    }));
    exportMonthlyReportToExcel(className, monthName, exportData);
    show('تم تصدير التقرير الشهري إلى إكسل', 'success');
  }

  function handleWhatsApp() {
    if (studentData.length === 0) {
      show('لا توجد بيانات للمشاركة', 'warning');
      return;
    }
    const className = classes.find((c) => c.id === selectedClassId)?.name || '';
    const monthName = ARABIC_MONTHS[selectedMonth];

    let text = `📋 *التقرير الشهري للغياب*\n`;
    text += `🏫 مدرسة أحمد الفاتح الإعدادية للبنين\n`;
    text += `📅 ${monthName} ${selectedYear}\n`;
    text += `🏫 الصف: ${className}\n`;
    text += `═════════════════\n`;

    const studentsWithAbsence = studentData.filter((s) => s.totalCount > 0);
    if (studentsWithAbsence.length === 0) {
      text += `\n✅ لا يوجد غياب في هذا الشهر\n`;
    } else {
      text += `\n*قائمة الغياب:*\n`;
      studentsWithAbsence.forEach((s) => {
        text += `\n👤 ${s.student_name}\n`;
        text += `   ⚠️ بعذر: ${s.excusedCount} | ❌ بلا عذر: ${s.unexcusedCount} | الإجمالي: ${s.totalCount}\n`;
        s.absences.forEach((a) => {
          const icon = a.status === 'غائب بعذر' ? '⚠️' : '❌';
          text += `   ${icon} ${formatArabicDateShort(a.date)} - ${a.status}\n`;
        });
      });
    }
    shareViaWhatsApp(text);
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const selectedClassName = classes.find((c) => c.id === selectedClassId)?.name || '';
  const monthName = ARABIC_MONTHS[selectedMonth];
  const totalExcused = studentData.reduce((sum, s) => sum + s.excusedCount, 0);
  const totalUnexcused = studentData.reduce((sum, s) => sum + s.unexcusedCount, 0);
  const totalAbsences = totalExcused + totalUnexcused;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-amber-100 p-2.5 rounded-lg">
          <CalendarDays className="w-6 h-6 text-amber-600" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">التقرير الشهري</h1>
      </div>

      {/* أدوات التحكم */}
      <div className="card mb-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الصف</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="input-field"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الشهر</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="input-field"
            >
              {ARABIC_MONTHS.map((month, idx) => (
                <option key={idx} value={idx}>{month}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">السنة</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="input-field"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* أزرار الإجراءات */}
      {studentData.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 no-print">
          <button onClick={handlePrint} className="btn-secondary">
            <Printer className="w-4 h-4" />
            طباعة / PDF
          </button>
          <button onClick={handleExportExcel} className="btn-success">
            <Download className="w-4 h-4" />
            تصدير التقرير (إكسل)
          </button>
          <button onClick={handleWhatsApp} className="btn-whatsapp">
            <Share2 className="w-4 h-4" />
            مشاركة عبر واتساب
          </button>
        </div>
      )}

      {/* التقرير */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">جارٍ تحميل التقرير...</div>
      ) : studentData.length === 0 ? (
        <div className="card text-center py-12">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">لا يوجد طلاب في هذا الصف</p>
        </div>
      ) : (
        <div className="card">
          {/* رأس التقرير */}
          <div className="text-center mb-4 pb-4 border-b border-gray-200">
            <p className="text-sm text-gray-600">مملكة البحرين - وزارة التربية والتعليم</p>
            <p className="text-base font-bold text-gray-800 mt-1">مدرسة أحمد الفاتح الإعدادية للبنين</p>
            <p className="text-lg font-bold text-[#CE1126] mt-2">تقرير الغياب الشهري</p>
            <p className="text-sm text-gray-600 mt-2">
              الصف: {selectedClassName} — {monthName} {selectedYear}
            </p>
          </div>

          {/* ملخص الإحصائيات */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
              <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
              <p className="text-xs text-amber-700 font-semibold">إجمالي الغياب بعذر</p>
              <p className="text-lg font-bold text-amber-700">{totalExcused}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
              <p className="text-xs text-red-700 font-semibold">إجمالي الغياب بلا عذر</p>
              <p className="text-lg font-bold text-red-700">{totalUnexcused}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <BookOpen className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-xs text-blue-700 font-semibold">إجمالي أيام الغياب</p>
              <p className="text-lg font-bold text-blue-700">{totalAbsences}</p>
            </div>
          </div>

          {/* جدول التقرير */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="text-right py-2 px-3 font-semibold w-12">الرقم</th>
                  <th className="text-right py-2 px-3 font-semibold">اسم الطالب</th>
                  <th className="text-center py-2 px-3 font-semibold">غائب بعذر</th>
                  <th className="text-center py-2 px-3 font-semibold">غائب بلا عذر</th>
                  <th className="text-center py-2 px-3 font-semibold">الإجمالي</th>
                  <th className="text-right py-2 px-3 font-semibold hidden sm:table-cell">أيام الغياب</th>
                </tr>
              </thead>
              <tbody>
                {studentData.map((s, idx) => (
                  <tr key={s.student_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-800">{s.student_name}</td>
                    <td className="text-center py-2.5 px-3">
                      <span className={`font-bold ${s.excusedCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {s.excusedCount}
                      </span>
                    </td>
                    <td className="text-center py-2.5 px-3">
                      <span className={`font-bold ${s.unexcusedCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {s.unexcusedCount}
                      </span>
                    </td>
                    <td className="text-center py-2.5 px-3">
                      <span className={`font-bold ${s.totalCount > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                        {s.totalCount}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-600 hidden sm:table-cell max-w-xs">
                      {s.absences.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.absences.map((a, aIdx) => {
                            const colors = STATUS_COLORS[a.status as keyof typeof STATUS_COLORS];
                            return (
                              <span
                                key={aIdx}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text} border ${colors.border}`}
                              >
                                {formatArabicDateShort(a.date)}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-emerald-600 font-semibold">لا يوجد غياب</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* تفاصيل الغياب للهاتف */}
          <div className="sm:hidden mt-4 space-y-3">
            {studentData.filter((s) => s.totalCount > 0).map((s) => (
              <div key={s.student_id} className="border border-gray-200 rounded-lg p-3">
                <p className="font-bold text-gray-800 mb-2">{s.student_name}</p>
                <div className="flex gap-2 mb-2 text-xs">
                  <span className="text-amber-600">بعذر: {s.excusedCount}</span>
                  <span className="text-red-600">بلا عذر: {s.unexcusedCount}</span>
                  <span className="text-gray-600">الإجمالي: {s.totalCount}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {s.absences.map((a, aIdx) => {
                    const colors = STATUS_COLORS[a.status as keyof typeof STATUS_COLORS];
                    return (
                      <span
                        key={aIdx}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${colors.bg} ${colors.text} border ${colors.border}`}
                      >
                        {formatArabicDateShort(a.date)}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
