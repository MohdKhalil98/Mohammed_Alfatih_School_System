import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { ClassRow, AttendanceWithStudent } from '@/lib/types';
import { formatArabicDate, formatArabicDateShort, formatArabicDayName, toDateString, STATUS_COLORS } from '@/lib/types';
import {
  exportDailyAttendanceToExcel,
  exportAllClassesDailyToExcel,
  shareViaWhatsApp,
  generateDailyReportText,
  generateAllClassesDailyText,
} from '@/lib/export';
import { FileText, Calendar, Download, Share2, Printer, CheckCircle, AlertCircle, XCircle, BookOpen } from 'lucide-react';

type ClassReport = {
  className: string;
  records: AttendanceWithStudent[];
};

export default function DailyReport() {
  const { show } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(toDateString(new Date()));
  const [loading, setLoading] = useState(false);
  const [classReports, setClassReports] = useState<ClassReport[]>([]);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classes, setClasses] = useState<ClassRow[]>([]);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes]);

  useEffect(() => {
    if (viewMode === 'all' || selectedClassId) {
      loadReport();
    }
  }, [selectedDate, viewMode, selectedClassId]);

  async function loadClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name, order_index, created_at')
      .order('order_index', { ascending: true });
    if (data) setClasses(data);
  }

  async function loadReport() {
    setLoading(true);
    if (viewMode === 'single') {
      const className = classes.find((c) => c.id === selectedClassId)?.name || '';
      const { data: attData } = await supabase
        .from('attendance')
        .select('id, student_id, class_id, date, status, note')
        .eq('class_id', selectedClassId)
        .eq('date', selectedDate);

      if (!attData || attData.length === 0) {
        setClassReports([]);
        setLoading(false);
        return;
      }

      const studentIds = attData.map((a) => a.student_id);
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, name, class_id')
        .in('id', studentIds);

      const records: AttendanceWithStudent[] = attData.map((a) => ({
        ...a,
        status: a.status as AttendanceWithStudent['status'],
        student_name: studentsData?.find((s) => s.id === a.student_id)?.name || '',
        class_name: className,
      }));
      records.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
      setClassReports([{ className, records }]);
    } else {
      // تحميل جميع الصفوف
      const { data: attData } = await supabase
        .from('attendance')
        .select('id, student_id, class_id, date, status, note')
        .eq('date', selectedDate);

      if (!attData || attData.length === 0) {
        setClassReports([]);
        setLoading(false);
        return;
      }

      const studentIds = attData.map((a) => a.student_id);
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, name, class_id')
        .in('id', studentIds);

      const reports: ClassReport[] = [];
      for (const cls of classes) {
        const classAtt = attData.filter((a) => a.class_id === cls.id);
        if (classAtt.length === 0) continue;
        const records: AttendanceWithStudent[] = classAtt.map((a) => ({
          ...a,
          status: a.status as AttendanceWithStudent['status'],
          student_name: studentsData?.find((s) => s.id === a.student_id)?.name || '',
          class_name: cls.name,
        }));
        records.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
        reports.push({ className: cls.name, records });
      }
      setClassReports(reports);
    }
    setLoading(false);
  }

  function handlePrint() {
    window.print();
  }

  function handleExportExcel() {
    if (classReports.length === 0) {
      show('لا توجد بيانات للتصدير', 'warning');
      return;
    }
    if (viewMode === 'single' && classReports.length === 1) {
      exportDailyAttendanceToExcel(classReports[0].className, selectedDate, classReports[0].records);
    } else {
      exportAllClassesDailyToExcel(selectedDate, classReports);
    }
    show('تم تصدير التقرير إلى إكسل', 'success');
  }

  function handleWhatsApp() {
    if (classReports.length === 0) {
      show('لا توجد بيانات للمشاركة', 'warning');
      return;
    }
    let text: string;
    if (viewMode === 'single' && classReports.length === 1) {
      text = generateDailyReportText(classReports[0].className, selectedDate, classReports[0].records);
    } else {
      text = generateAllClassesDailyText(selectedDate, classReports);
    }
    shareViaWhatsApp(text);
  }

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const allRecords = classReports.flatMap((r) => r.records);
  const totalPresent = allRecords.filter((r) => r.status === 'حاضر').length;
  const totalExcused = allRecords.filter((r) => r.status === 'غائب بعذر').length;
  const totalUnexcused = allRecords.filter((r) => r.status === 'غائب بلا عذر').length;
  const totalStudents = allRecords.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-emerald-100 p-2.5 rounded-lg">
          <FileText className="w-6 h-6 text-emerald-600" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">التقرير اليومي</h1>
      </div>

      {/* أدوات التحكم */}
      <div className="card mb-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">نوع التقرير</label>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('all')}
                className={viewMode === 'all' ? 'btn-primary' : 'btn-secondary'}
              >
                تقرير شامل (جميع الصفوف)
              </button>
              <button
                onClick={() => setViewMode('single')}
                className={viewMode === 'single' ? 'btn-primary' : 'btn-secondary'}
              >
                صف محدد
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">التاريخ</label>
            <div className="relative">
              <Calendar className="w-5 h-5 text-gray-400 absolute top-1/2 -translate-y-1/2 left-3 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field pr-4 pl-10"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{formatArabicDate(dateObj)}</p>
          </div>
        </div>

        {viewMode === 'single' && (
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">اختر الصف</label>
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
        )}
      </div>

      {/* أزرار الإجراءات */}
      {classReports.length > 0 && (
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
      ) : classReports.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">لا توجد سجلات حضور مسجلة في هذا التاريخ</p>
          <p className="text-sm text-gray-400 mt-1">يمكنك تسجيل الحضور من صفحة «تسجيل الحضور والغياب»</p>
        </div>
      ) : (
        <>
          {/* رأس التقرير للطباعة */}
          <div className="card mb-4">
            <div className="text-center mb-4 pb-4 border-b border-gray-200">
              <p className="text-sm text-gray-600">مملكة البحرين - وزارة التربية والتعليم</p>
              <p className="text-base font-bold text-gray-800 mt-1">مدرسة أحمد الفاتح الإعدادية للبنين</p>
              <p className="text-lg font-bold text-[#CE1126] mt-2">تقرير الحضور والغياب اليومي</p>
              <p className="text-sm text-gray-600 mt-2">
                {formatArabicDateShort(selectedDate)} - {formatArabicDayName(selectedDate)}
              </p>
            </div>

            {/* الإحصائيات العامة */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-xs text-emerald-700 font-semibold">حاضر</p>
                <p className="text-lg font-bold text-emerald-700">{totalPresent}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-xs text-amber-700 font-semibold">بعذر</p>
                <p className="text-lg font-bold text-amber-700">{totalExcused}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                <p className="text-xs text-red-700 font-semibold">بلا عذر</p>
                <p className="text-lg font-bold text-red-700">{totalUnexcused}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <BookOpen className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-xs text-blue-700 font-semibold">الإجمالي</p>
                <p className="text-lg font-bold text-blue-700">{totalStudents}</p>
              </div>
            </div>
          </div>

          {/* تفاصيل كل صف */}
          <div className="space-y-4">
            {classReports.map((cls, idx) => {
              const present = cls.records.filter((r) => r.status === 'حاضر').length;
              const excused = cls.records.filter((r) => r.status === 'غائب بعذر').length;
              const unexcused = cls.records.filter((r) => r.status === 'غائب بلا عذر').length;
              return (
                <div key={idx} className="card">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-[#CE1126]" />
                      <h3 className="font-bold text-gray-800">{cls.className}</h3>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                        حاضر: {present}
                      </span>
                      <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                        بعذر: {excused}
                      </span>
                      <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-semibold border border-red-200">
                        بلا عذر: {unexcused}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-600">
                          <th className="text-right py-2 px-3 font-semibold w-12">الرقم</th>
                          <th className="text-right py-2 px-3 font-semibold">اسم الطالب</th>
                          <th className="text-center py-2 px-3 font-semibold">الحالة</th>
                          <th className="text-right py-2 px-3 font-semibold">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cls.records.map((record, rIdx) => {
                          const colors = STATUS_COLORS[record.status];
                          return (
                            <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-3 text-gray-500">{rIdx + 1}</td>
                              <td className="py-2 px-3 font-semibold text-gray-800">{record.student_name}</td>
                              <td className="text-center py-2 px-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
                                  {record.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-gray-600 text-xs">{record.note || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
