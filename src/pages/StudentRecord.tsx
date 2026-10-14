import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { ClassRow, StudentRow, AttendanceRow } from '@/lib/types';
import { formatArabicDateShort, formatArabicDayName, STATUS_COLORS } from '@/lib/types';
import { exportStudentReportToExcel, shareViaWhatsApp } from '@/lib/export';
import { User, Search, Download, Share2, Printer, CheckCircle, AlertCircle, XCircle, Calendar } from 'lucide-react';

export default function StudentRecord() {
  const { show } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AttendanceRow[]>([]);

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
      loadStudents();
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedStudentId) {
      loadRecords();
    } else {
      setRecords([]);
    }
  }, [selectedStudentId]);

  async function loadClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name, order_index, created_at')
      .order('order_index', { ascending: true });
    if (data) setClasses(data);
  }

  async function loadStudents() {
    const { data } = await supabase
      .from('students')
      .select('id, name, class_id, created_at')
      .eq('class_id', selectedClassId)
      .order('name', { ascending: true });
    setStudents(data || []);
    setSelectedStudentId('');
  }

  async function loadRecords() {
    setLoading(true);
    const { data } = await supabase
      .from('attendance')
      .select('id, student_id, class_id, date, status, note, created_at')
      .eq('student_id', selectedStudentId)
      .order('date', { ascending: false });
    setRecords((data || []) as AttendanceRow[]);
    setLoading(false);
  }

  function handlePrint() {
    window.print();
  }

  function handleExportExcel() {
    if (records.length === 0) {
      show('لا توجد سجلات للتصدير', 'warning');
      return;
    }
    const student = students.find((s) => s.id === selectedStudentId);
    const className = classes.find((c) => c.id === selectedClassId)?.name || '';
    exportStudentReportToExcel(student?.name || 'طالب', className, records);
    show('تم تصدير سجل الطالب إلى إكسل', 'success');
  }

  function handleWhatsApp() {
    if (records.length === 0) {
      show('لا توجد سجلات للمشاركة', 'warning');
      return;
    }
    const student = students.find((s) => s.id === selectedStudentId);
    const className = classes.find((c) => c.id === selectedClassId)?.name || '';
    const present = records.filter((r) => r.status === 'حاضر').length;
    const excused = records.filter((r) => r.status === 'غائب بعذر').length;
    const unexcused = records.filter((r) => r.status === 'غائب بلا عذر').length;

    let text = `📋 *سجل الطالب*\n`;
    text += `🏫 مدرسة أحمد الفاتح الإعدادية للبنين\n`;
    text += `👤 الاسم: ${student?.name || ''}\n`;
    text += `🏫 الصف: ${className}\n`;
    text += `═════════════════\n`;
    text += `📊 *الملخص:*\n`;
    text += `✅ حاضر: ${present}\n`;
    text += `⚠️ غائب بعذر: ${excused}\n`;
    text += `❌ غائب بلا عذر: ${unexcused}\n`;
    text += `📅 إجمالي الأيام المسجلة: ${records.length}\n`;
    text += `═════════════════\n`;

    if (excused + unexcused > 0) {
      text += `\n*أيام الغياب:*\n`;
      records
        .filter((r) => r.status !== 'حاضر')
        .forEach((r) => {
          const icon = r.status === 'غائب بعذر' ? '⚠️' : '❌';
          text += `${icon} ${formatArabicDateShort(r.date)} - ${formatArabicDayName(r.date)} - ${r.status}`;
          if (r.note) text += ` (${r.note})`;
          text += `\n`;
        });
    }
    shareViaWhatsApp(text);
  }

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedClassName = classes.find((c) => c.id === selectedClassId)?.name || '';
  const present = records.filter((r) => r.status === 'حاضر').length;
  const excused = records.filter((r) => r.status === 'غائب بعذر').length;
  const unexcused = records.filter((r) => r.status === 'غائب بلا عذر').length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-2.5 rounded-lg">
          <User className="w-6 h-6 text-blue-600" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">سجل الطالب</h1>
      </div>

      {/* اختيار الصف والطالب */}
      <div className="card mb-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">بحث عن طالب</label>
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="اكتب اسم الطالب..."
                className="input-field pr-10"
              />
            </div>
          </div>
        </div>

        {filteredStudents.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">اختر الطالب</label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`w-full text-right px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                    selectedStudentId === student.id ? 'bg-[#CE1126]/5 font-bold text-[#CE1126]' : 'text-gray-700'
                  }`}
                >
                  <User className="w-4 h-4 flex-shrink-0" />
                  {student.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {students.length > 0 && filteredStudents.length === 0 && (
          <p className="text-sm text-gray-500 mt-4 text-center py-4">لا يوجد طالب بهذا الاسم</p>
        )}
      </div>

      {/* أزرار الإجراءات */}
      {selectedStudentId && records.length > 0 && (
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

      {/* سجل الطالب */}
      {!selectedStudentId ? (
        <div className="card text-center py-12">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">يرجى اختيار طالب لعرض سجله</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-gray-500">جارٍ تحميل السجل...</div>
      ) : (
        <div className="card">
          {/* رأس السجل */}
          <div className="text-center mb-4 pb-4 border-b border-gray-200">
            <p className="text-sm text-gray-600">مملكة البحرين - وزارة التربية والتعليم</p>
            <p className="text-base font-bold text-gray-800 mt-1">مدرسة أحمد الفاتح الإعدادية للبنين</p>
            <p className="text-lg font-bold text-[#CE1126] mt-2">السجل الفردي للطالب</p>
            <div className="mt-3 inline-flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
              <User className="w-5 h-5 text-gray-600" />
              <span className="font-bold text-gray-800">{selectedStudent?.name}</span>
              <span className="text-gray-400">|</span>
              <span className="text-sm text-gray-600">{selectedClassName}</span>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">لا توجد سجلات حضور مسجلة لهذا الطالب</p>
            </div>
          ) : (
            <>
              {/* ملخص الإحصائيات */}
              <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                  <p className="text-xs text-emerald-700 font-semibold">حاضر</p>
                  <p className="text-lg font-bold text-emerald-700">{present}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                  <p className="text-xs text-amber-700 font-semibold">بعذر</p>
                  <p className="text-lg font-bold text-amber-700">{excused}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                  <p className="text-xs text-red-700 font-semibold">بلا عذر</p>
                  <p className="text-lg font-bold text-red-700">{unexcused}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <Calendar className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs text-blue-700 font-semibold">المسجل</p>
                  <p className="text-lg font-bold text-blue-700">{records.length}</p>
                </div>
              </div>

              {/* جدول السجل */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="text-right py-2 px-3 font-semibold w-12">الرقم</th>
                      <th className="text-right py-2 px-3 font-semibold">التاريخ</th>
                      <th className="text-right py-2 px-3 font-semibold hidden sm:table-cell">اليوم</th>
                      <th className="text-center py-2 px-3 font-semibold">الحالة</th>
                      <th className="text-right py-2 px-3 font-semibold">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, idx) => {
                      const colors = STATUS_COLORS[record.status];
                      return (
                        <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-semibold text-gray-800">{formatArabicDateShort(record.date)}</td>
                          <td className="py-2.5 px-3 text-gray-600 hidden sm:table-cell">{formatArabicDayName(record.date)}</td>
                          <td className="text-center py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
                              {record.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-600 text-xs">{record.note || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
