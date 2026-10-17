import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { ClassRow, StudentRow, AttendanceStatus } from '@/lib/types';
import { formatArabicDate, toDateString, STATUS_COLORS } from '@/lib/types';
import { ClipboardCheck, CheckCircle2, AlertCircle, XCircle, CheckCheck, Save, Calendar, Paperclip, Upload, X } from 'lucide-react';

type StudentAttendance = {
  student: StudentRow;
  status: AttendanceStatus;
  note: string;
  excuseFilePath?: string | null;
  existingId?: string;
};

export default function Attendance() {
  const { show } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(toDateString(new Date()));
  const [attendanceMap, setAttendanceMap] = useState<Map<string, StudentAttendance>>(new Map());
  const [saving, setSaving] = useState(false);
  const [hasExistingRecords, setHasExistingRecords] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('حاضر');
  const [excuseStudentId, setExcuseStudentId] = useState<string | null>(null);
  const [excuseFile, setExcuseFile] = useState<File | null>(null);
  const [uploadingExcuse, setUploadingExcuse] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadData();
    }
  }, [selectedClassId, selectedDate]);

  async function loadClasses() {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, order_index, created_at')
      .order('order_index', { ascending: true });
    if (error) {
      show('فشل في تحميل الصفوف', 'error');
    } else {
      setClasses(data || []);
      if (data && data.length > 0) {
        setSelectedClassId(data[0].id);
      }
    }
  }

  async function loadData() {
    setLoading(true);
    // تحميل طلاب الصف
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, name, class_id, created_at')
      .eq('class_id', selectedClassId)
      .order('name', { ascending: true });

    if (studentError) {
      show('فشل في تحميل الطلاب', 'error');
      setLoading(false);
      return;
    }

    setStudents(studentData || []);

    // تحميل سجلات الحضور لهذا اليوم وهذا الصف
    const { data: attData, error: attError } = await supabase
      .from('attendance')
      .select('id, student_id, class_id, date, status, note, excuse_file_path')
      .eq('class_id', selectedClassId)
      .eq('date', selectedDate);

    if (attError) {
      show('فشل في تحميل سجلات الحضور', 'error');
      setLoading(false);
      return;
    }

    const existingRecords = attData || [];
    setHasExistingRecords(existingRecords.length > 0);

    const newMap = new Map<string, StudentAttendance>();
    for (const student of studentData || []) {
      const existing = existingRecords.find((a) => a.student_id === student.id);
      if (existing) {
        newMap.set(student.id, {
          student,
          status: existing.status as AttendanceStatus,
          note: existing.note || '',
          excuseFilePath: existing.excuse_file_path || null,
          existingId: existing.id,
        });
      } else {
        newMap.set(student.id, {
          student,
          status: 'حاضر' as AttendanceStatus,
          note: '',
        });
      }
    }
    setAttendanceMap(newMap);
    setLoading(false);
  }

  function setStatus(studentId: string, status: AttendanceStatus) {
    setAttendanceMap((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId);
      if (current) {
        newMap.set(studentId, { ...current, status });
      }
      return newMap;
    });
  }

  function handleStatusClick(studentId: string, status: AttendanceStatus) {
    setStatus(studentId, status);
    if (status === 'غائب بعذر') {
      setExcuseFile(null);
      setExcuseStudentId(studentId);
    }
  }

  function closeExcuseModal(revert: boolean) {
    if (revert && excuseStudentId) {
      const current = attendanceMap.get(excuseStudentId);
      if (current && !current.excuseFilePath && current.existingId === undefined) {
        setStatus(excuseStudentId, 'حاضر');
      }
    }
    setExcuseStudentId(null);
    setExcuseFile(null);
  }

  async function confirmExcuse() {
    if (!excuseStudentId) return;
    if (excuseFile) {
      setUploadingExcuse(true);
      const ext = excuseFile.name.split('.').pop() || 'bin';
      const path = `${selectedDate}/${excuseStudentId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('attendance-excuses').upload(path, excuseFile);
      setUploadingExcuse(false);
      if (error) {
        show('فشل في رفع مرفق العذر', 'error');
        return;
      }
      setAttendanceMap((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(excuseStudentId);
        if (current) newMap.set(excuseStudentId, { ...current, excuseFilePath: path });
        return newMap;
      });
    }
    setExcuseStudentId(null);
    setExcuseFile(null);
  }

  function setNote(studentId: string, note: string) {
    setAttendanceMap((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId);
      if (current) {
        newMap.set(studentId, { ...current, note });
      }
      return newMap;
    });
  }

  function markAll() {
    setAttendanceMap((prev) => {
      const newMap = new Map(prev);
      for (const [key, value] of newMap) {
        newMap.set(key, { ...value, status: bulkStatus, note: '' });
      }
      return newMap;
    });
    show(
      bulkStatus === 'حاضر' ? 'تم تحديد جميع الطلاب كحاضرين' : 'تم تحديد جميع الطلاب كغائبين',
      'success'
    );
  }

  async function saveAttendance() {
    if (students.length === 0) {
      show('لا يوجد طلاب في هذا الصف', 'warning');
      return;
    }
    setSaving(true);
    let savedCount = 0;
    let errorCount = 0;

    for (const [, value] of attendanceMap) {
      if (value.existingId) {
        // تحديث السجل الموجود
        const { error } = await supabase
          .from('attendance')
          .update({
            status: value.status,
            note: value.note || null,
            excuse_file_path: value.status === 'غائب بعذر' ? value.excuseFilePath || null : null,
          })
          .eq('id', value.existingId);
        if (error) {
          errorCount++;
        } else {
          savedCount++;
        }
      } else {
        // إدراج سجل جديد
        const { error } = await supabase.from('attendance').insert({
          student_id: value.student.id,
          class_id: selectedClassId,
          date: selectedDate,
          status: value.status,
          note: value.note || null,
          excuse_file_path: value.status === 'غائب بعذر' ? value.excuseFilePath || null : null,
        });
        if (error) {
          errorCount++;
        } else {
          savedCount++;
        }
      }
    }

    if (errorCount > 0 && savedCount === 0) {
      show('فشل في حفظ السجلات', 'error');
    } else if (errorCount > 0) {
      show(`تم حفظ ${savedCount} سجل، وفشل ${errorCount} سجل`, 'warning');
    } else {
      show(`تم حفظ سجلات الحضور بنجاح (${savedCount} طالب)`, 'success');
    }
    setSaving(false);
    loadData();
  }

  const stats = {
    present: Array.from(attendanceMap.values()).filter((a) => a.status === 'حاضر').length,
    excused: Array.from(attendanceMap.values()).filter((a) => a.status === 'غائب بعذر').length,
    unexcused: Array.from(attendanceMap.values()).filter((a) => a.status === 'غائب بلا عذر').length,
  };
  const total = students.length;
  const presentPercent = total > 0 ? Math.round((stats.present / total) * 100) : 0;

  const statusButtons: { status: AttendanceStatus; icon: typeof CheckCircle2; label: string }[] = [
    { status: 'حاضر', icon: CheckCircle2, label: 'حاضر' },
    { status: 'غائب بعذر', icon: AlertCircle, label: 'بعذر' },
    { status: 'غائب بلا عذر', icon: XCircle, label: 'بلا عذر' },
  ];

  const dateObj = new Date(selectedDate + 'T00:00:00');

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-[#CE1126]/10 p-2.5 rounded-lg">
          <ClipboardCheck className="w-6 h-6 text-[#CE1126]" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">تسجيل الحضور والغياب</h1>
      </div>

      {/* اختيار الصف والتاريخ */}
      <div className="card mb-4">
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
      </div>

      {!selectedClassId ? (
        <div className="card text-center py-12">
          <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">يرجى اختيار صف لتسجيل الحضور</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-gray-500">جارٍ تحميل البيانات...</div>
      ) : students.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">لا يوجد طلاب في هذا الصف. يرجى إضافة الطلاب من صفحة إدارة الطلاب.</p>
        </div>
      ) : (
        <>
          {/* الإحصائيات السريعة */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
              <p className="text-xs sm:text-sm text-emerald-700 font-semibold">حاضر</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-700">{stats.present}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
              <p className="text-xs sm:text-sm text-amber-700 font-semibold">غائب بعذر</p>
              <p className="text-xl sm:text-2xl font-bold text-amber-700">{stats.excused}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <p className="text-xs sm:text-sm text-red-700 font-semibold">غائب بلا عذر</p>
              <p className="text-xl sm:text-2xl font-bold text-red-700">{stats.unexcused}</p>
            </div>
          </div>

          {/* شريط النسبة */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">نسبة الحضور</span>
              <span className="text-sm font-bold text-emerald-600">{presentPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${presentPercent}%` }}
              />
            </div>
          </div>

          {/* أزرار التحكم */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <button onClick={markAll} className="btn-success">
                <CheckCheck className="w-4 h-4" />
                اختيار الكل
              </button>
              {hasExistingRecords && (
                <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  تم تسجيل الحضور لهذا اليوم مسبقًا
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
                {([
                  { status: 'حاضر', label: 'حاضر', active: 'bg-emerald-600 text-white' },
                  { status: 'غائب بلا عذر', label: 'غائب', active: 'bg-red-600 text-white' },
                ] as const).map((opt) => (
                  <button
                    key={opt.status}
                    onClick={() => setBulkStatus(opt.status)}
                    className={`px-4 py-2 text-sm font-semibold transition-all ${
                      bulkStatus === opt.status ? opt.active : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button onClick={saveAttendance} disabled={saving} className="btn-primary">
                <Save className="w-4 h-4" />
                {saving ? 'جارٍ الحفظ...' : 'حفظ السجلات'}
              </button>
            </div>
          </div>

          {/* قائمة الطلاب */}
          <div className="card">
            <div className="divide-y divide-gray-100">
              {students.map((student, idx) => {
                const att = attendanceMap.get(student.id);
                if (!att) return null;
                const colors = STATUS_COLORS[att.status];
                return (
                  <div key={student.id} className="py-3 px-2 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${colors.bg} ${colors.text}`}>
                        {idx + 1}
                      </div>
                      <span className="font-semibold text-gray-800 truncate">{student.name}</span>
                      <div className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
                        {att.status}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {statusButtons.map((btn) => {
                        const Icon = btn.icon;
                        const isActive = att.status === btn.status;
                        const btnColor =
                          btn.status === 'حاضر'
                            ? isActive
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-emerald-600 border-emerald-300 hover:bg-emerald-50'
                            : btn.status === 'غائب بعذر'
                            ? isActive
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-white text-amber-600 border-amber-300 hover:bg-amber-50'
                            : isActive
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white text-red-600 border-red-300 hover:bg-red-50';
                        return (
                          <button
                            key={btn.status}
                            onClick={() => handleStatusClick(student.id, btn.status)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${btnColor}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {btn.label}
                          </button>
                        );
                      })}
                      {att.status === 'غائب بعذر' && att.excuseFilePath && (
                        <span className="flex items-center gap-1 text-xs text-amber-700" title="تم إرفاق العذر">
                          <Paperclip className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {att.status !== 'حاضر' && (
                        <input
                          type="text"
                          value={att.note}
                          onChange={(e) => setNote(student.id, e.target.value)}
                          placeholder="ملاحظة..."
                          className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#CE1126]"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* زر حفظ في الأسفل أيضاً */}
          <div className="mt-4 flex justify-center">
            <button onClick={saveAttendance} disabled={saving} className="btn-primary px-8 py-3">
              <Save className="w-5 h-5" />
              {saving ? 'جارٍ الحفظ...' : 'حفظ السجلات'}
            </button>
          </div>
        </>
      )}

      {excuseStudentId && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => closeExcuseModal(true)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">إرفاق العذر الرسمي</h2>
              <button onClick={() => closeExcuseModal(true)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              الطالب: <span className="font-semibold">{attendanceMap.get(excuseStudentId)?.student.name}</span>
            </p>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-amber-300 bg-amber-50 rounded-lg p-6 cursor-pointer hover:bg-amber-100 transition-colors">
              <Upload className="w-7 h-7 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">
                {excuseFile ? excuseFile.name : 'اضغط لاختيار ملف العذر (صورة أو PDF)'}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setExcuseFile(e.target.files?.[0] || null)}
              />
            </label>
            {attendanceMap.get(excuseStudentId)?.excuseFilePath && !excuseFile && (
              <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5" />
                يوجد مرفق محفوظ مسبقًا لهذا الطالب
              </p>
            )}
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => closeExcuseModal(true)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                إلغاء
              </button>
              <button onClick={confirmExcuse} disabled={uploadingExcuse} className="btn-primary">
                {uploadingExcuse ? 'جارٍ الرفع...' : excuseFile ? 'رفع وتأكيد' : 'تأكيد بدون مرفق'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
