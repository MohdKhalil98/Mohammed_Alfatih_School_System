import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { downloadFile } from '@/lib/export';
import type { ClassRow, StudentRow, AttendanceRow } from '@/lib/types';
import { Database, Download, Upload, AlertTriangle, Archive, RefreshCw } from 'lucide-react';

type BackupData = {
  exportDate: string;
  classes: ClassRow[];
  students: StudentRow[];
  attendance: AttendanceRow[];
  discipline?: Record<string, unknown[]>;
};

// جداول الانضباط الطلابي (تصدير فقط؛ الاسترجاع الآلي لها غير مفعّل لحمايتها)
const DISCIPLINE_TABLES = [
  'school_settings', 'holidays', 'violation_categories', 'violations_catalog', 'incidents',
  'incident_actions', 'guardian_summons', 'committee_referrals', 'documents', 'attachments', 'profiles',
];

export default function Backup() {
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<BackupData | null>(null);

  async function handleBackup() {
    setLoading(true);
    try {
      // تحميل جميع البيانات
      const { data: classes, error: err1 } = await supabase.from('classes').select('*');
      if (err1) throw err1;

      const { data: students, error: err2 } = await supabase.from('students').select('*');
      if (err2) throw err2;

      const { data: attendance, error: err3 } = await supabase.from('attendance').select('*');
      if (err3) throw err3;

      // جداول الانضباط: تُضاف عند تسجيل الدخول بصلاحية قراءتها؛ غيابها لا يمنع النسخ
      const discipline: Record<string, unknown[]> = {};
      for (const t of DISCIPLINE_TABLES) {
        const { data, error } = await supabase.from(t).select('*');
        if (!error && data) discipline[t] = data;
      }

      const backup: BackupData = {
        exportDate: new Date().toISOString(),
        classes: classes || [],
        students: students || [],
        attendance: attendance || [],
        ...(Object.keys(discipline).length ? { discipline } : {}),
      };

      const fileName = `نسخة_احتياطية_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(JSON.stringify(backup, null, 2), fileName, 'application/json');
      show(`تم إنشاء نسخة احتياطية بنجاح (${(classes || []).length} صف، ${(students || []).length} طالب، ${(attendance || []).length} سجل حضور)`, 'success');
    } catch {
      show('فشل في إنشاء النسخة الاحتياطية', 'error');
    }
    setLoading(false);
  }

  function handleRestoreFile(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data: BackupData = JSON.parse(e.target?.result as string);
        if (!data.classes || !data.students || !data.attendance) {
          show('الملف غير صالح — لا يحتوي على بيانات النسخة الاحتياطية', 'error');
          return;
        }
        setRestoreConfirm(data);
      } catch {
        show('فشل في قراءة الملف — تأكد من أنه ملف نسخة احتياطية صالح', 'error');
      }
    };
    reader.onerror = () => show('فشل في قراءة الملف', 'error');
    reader.readAsText(file);
  }

  async function confirmRestore() {
    if (!restoreConfirm) return;
    setLoading(true);
    try {
      const data = restoreConfirm;

      // حماية سجلات الانضباط: الاسترجاع يحذف الطلاب أولًا، ما يتعارض مع الوقائع المرتبطة بهم
      const { data: count, error: cntErr } = await supabase.rpc('discipline_record_count');
      const fnMissing = cntErr && (cntErr.code === 'PGRST202' || /Could not find the function/i.test(cntErr.message));
      if ((cntErr && !fnMissing) || (typeof count === 'number' ? count : Number(count ?? 0)) > 0) {
        show('لا يمكن الاسترجاع الآلي: توجد وقائع انضباط مرتبطة بالطلاب (أو تعذر التحقق منها). تواصل مع مدير النظام لاسترجاع موثق.', 'error');
        setRestoreConfirm(null);
        setLoading(false);
        return;
      }

      // حذف البيانات الحالية (بالترتيب الصحيح للعلاقات)
      await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('classes').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // إعادة إدراج البيانات
      if (data.classes.length > 0) {
        const classRows = data.classes.map((c) => ({
          id: c.id,
          name: c.name,
          order_index: c.order_index,
          stage: (c as { stage?: string | null }).stage,
          grade_level: (c as { grade_level?: string | null }).grade_level,
          created_at: c.created_at,
        }));
        const { error: err1 } = await supabase.from('classes').insert(classRows);
        if (err1) throw err1;
      }

      if (data.students.length > 0) {
        const studentRows = data.students.map((s) => ({
          id: s.id,
          name: s.name,
          class_id: s.class_id,
          school_number: (s as { school_number?: string | null }).school_number,
          guardian_name: (s as { guardian_name?: string | null }).guardian_name,
          guardian_phone: (s as { guardian_phone?: string | null }).guardian_phone,
          created_at: s.created_at,
        }));
        const { error: err2 } = await supabase.from('students').insert(studentRows);
        if (err2) throw err2;
      }

      if (data.attendance.length > 0) {
        const attRows = data.attendance.map((a) => ({
          id: a.id,
          student_id: a.student_id,
          class_id: a.class_id,
          date: a.date,
          status: a.status,
          note: a.note,
          created_at: a.created_at,
        }));
        const { error: err3 } = await supabase.from('attendance').insert(attRows);
        if (err3) throw err3;
      }

      show('تمت استعادة البيانات بنجاح', 'success');
      setRestoreConfirm(null);
    } catch {
      show('فشل في استعادة البيانات', 'error');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gray-100 p-2.5 rounded-lg">
          <Database className="w-6 h-6 text-gray-700" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">حفظ البيانات والنسخ الاحتياطي</h1>
      </div>

      {/* بطاقة النسخ الاحتياطي */}
      <div className="card mb-4">
        <div className="flex items-start gap-4">
          <div className="bg-emerald-100 p-3 rounded-lg flex-shrink-0">
            <Download className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-800 mb-1">إنشاء نسخة احتياطية</h2>
            <p className="text-sm text-gray-600 mb-3">
              تنزيل جميع البيانات (الصفوف، الطلاب، سجلات الحضور) في ملف واحد على جهازك.
              يمكنك الاحتفاظ بهذا الملف كنسخة احتياطية أو لنقله إلى جهاز آخر.
            </p>
            <button
              onClick={handleBackup}
              disabled={loading}
              className="btn-success"
            >
              <Archive className="w-4 h-4" />
              {loading ? 'جارٍ الإنشاء...' : 'تنزيل نسخة احتياطية'}
            </button>
          </div>
        </div>
      </div>

      {/* بطاقة الاستعادة */}
      <div className="card mb-4">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 p-3 rounded-lg flex-shrink-0">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-800 mb-1">استعادة البيانات من نسخة احتياطية</h2>
            <p className="text-sm text-gray-600 mb-3">
              استعادة البيانات من ملف نسخة احتياطية تم تنزيله مسبقًا.
              سيتم استبدال جميع البيانات الحالية بالبيانات الموجودة في الملف.
            </p>
            <label className="btn-primary cursor-pointer">
              <RefreshCw className="w-4 h-4" />
              اختيار ملف للاستعادة
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleRestoreFile(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* معلومات إضافية */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-blue-800 text-sm mb-1">معلومات مهمة</h3>
            <ul className="text-sm text-blue-700 space-y-1 list-disc pr-4">
              <li>يتم حفظ جميع البيانات في قاعدة بيانات دائمة تلقائيًا.</li>
              <li>النسخة الاحتياطية إضافية لتتمكن من تنزيل البيانات على جهازك.</li>
              <li>عند الاستعادة، سيتم استبدال جميع البيانات الحالية.</li>
              <li>ينصح بإنشاء نسخة احتياطية بشكل دوري للحفاظ على بياناتك.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* تأكيد الاستعادة */}
      {restoreConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-amber-100 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">تأكيد الاستعادة</h2>
            </div>
            <p className="text-gray-600 mb-4">
              سيتم استبدال جميع البيانات الحالية بالبيانات التالية:
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
              <p className="text-gray-700">الصفوف: <span className="font-bold">{restoreConfirm.classes.length}</span></p>
              <p className="text-gray-700">الطلاب: <span className="font-bold">{restoreConfirm.students.length}</span></p>
              <p className="text-gray-700">سجلات الحضور: <span className="font-bold">{restoreConfirm.attendance.length}</span></p>
            </div>
            <p className="text-sm text-red-600 mb-6">
              تحذير: سيتم حذف جميع البيانات الحالية نهائيًا واستبدالها بالبيانات من الملف.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRestoreConfirm(null)} className="btn-secondary">
                إلغاء
              </button>
              <button onClick={confirmRestore} disabled={loading} className="btn-danger">
                <RefreshCw className="w-4 h-4" />
                {loading ? 'جارٍ الاستعادة...' : 'نعم، استعادة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
