import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { importFromExcel } from '@/lib/export';
import type { ClassRow, StudentRow } from '@/lib/types';
import { Plus, Edit2, Trash2, Save, X, Users, Upload, AlertTriangle, FileSpreadsheet, ClipboardPaste } from 'lucide-react';

export default function Students() {
  const { show } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<StudentRow | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importMode, setImportMode] = useState<'excel' | 'paste'>('paste');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importNames, setImportNames] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadStudents();
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  async function loadClasses() {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, order_index, created_at')
      .order('order_index', { ascending: true });
    if (error) {
      show('فشل في تحميل الصفوف', 'error');
    } else {
      setClasses(data || []);
      if (data && data.length > 0 && !selectedClassId) {
        setSelectedClassId(data[0].id);
      }
    }
  }

  async function loadStudents() {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('id, name, class_id, created_at')
      .eq('class_id', selectedClassId)
      .order('name', { ascending: true });
    if (error) {
      show('فشل في تحميل الطلاب', 'error');
    } else {
      setStudents(data || []);
    }
    setLoading(false);
  }

  async function addStudent() {
    if (!newName.trim()) {
      show('يرجى إدخال اسم الطالب', 'warning');
      return;
    }
    if (!selectedClassId) {
      show('يرجى اختيار صف أولاً', 'warning');
      return;
    }
    const { error } = await supabase
      .from('students')
      .insert({ name: newName.trim(), class_id: selectedClassId });
    if (error) {
      show('فشل في إضافة الطالب', 'error');
    } else {
      show('تمت إضافة الطالب بنجاح', 'success');
      setNewName('');
      setShowAdd(false);
      loadStudents();
    }
  }

  async function updateStudent(id: string) {
    if (!editName.trim()) {
      show('يرجى إدخال اسم الطالب', 'warning');
      return;
    }
    const { error } = await supabase
      .from('students')
      .update({ name: editName.trim() })
      .eq('id', id);
    if (error) {
      show('فشل في تعديل اسم الطالب', 'error');
    } else {
      show('تم تعديل اسم الطالب بنجاح', 'success');
      setEditingId(null);
      loadStudents();
    }
  }

  async function deleteStudent(id: string) {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) {
      show('فشل في حذف الطالب', 'error');
    } else {
      show('تم حذف الطالب وسجلات الحضور المرتبطة به', 'success');
      setDeleteConfirm(null);
      loadStudents();
    }
  }

  async function handleExcelImport(file: File) {
    try {
      show('جارٍ قراءة الملف...', 'info');
      const result = await importFromExcel(file);
      if (result.names.length === 0) {
        show('لم يتم العثور على أسماء في الملف', 'warning');
        return;
      }
      setImportNames(result.names);
      setImportMode('excel');
      setImportPreview(true);
      show(`تم العثور على ${result.names.length} اسم في الملف`, 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'فشل في قراءة الملف', 'error');
    }
  }

  function handlePasteImport() {
    const names = pasteText
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) {
      show('لم يتم إدخال أي أسماء', 'warning');
      return;
    }
    setImportNames(names);
    setImportMode('paste');
    setImportPreview(true);
  }

  async function confirmImport() {
    if (!selectedClassId) {
      show('يرجى اختيار صف أولاً', 'warning');
      return;
    }
    if (importNames.length === 0) {
      show('لا توجد أسماء لاستيرادها', 'warning');
      return;
    }
    show('جارٍ إضافة الطلاب...', 'info');
    const rows = importNames.map((name) => ({ name, class_id: selectedClassId }));
    const { error } = await supabase.from('students').insert(rows);
    if (error) {
      show('فشل في إضافة الطلاب', 'error');
    } else {
      show(`تمت إضافة ${importNames.length} طالب بنجاح`, 'success');
      setImportPreview(false);
      setImportNames([]);
      setPasteText('');
      setShowImport(false);
      loadStudents();
    }
  }

  const selectedClassName = classes.find((c) => c.id === selectedClassId)?.name || '';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2.5 rounded-lg">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">إدارة الطلاب</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport(!showImport); setShowAdd(false); }} className="btn-secondary">
            <Upload className="w-4 h-4" />
            استيراد أسماء
          </button>
          <button onClick={() => { setShowAdd(!showAdd); setShowImport(false); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            إضافة طالب
          </button>
        </div>
      </div>

      {/* اختيار الصف */}
      <div className="card mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">اختر الصف</label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="input-field"
        >
          {classes.length === 0 && <option value="">لا توجد صفوف</option>}
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
        {students.length > 0 && (
          <p className="text-sm text-gray-500 mt-2">عدد الطلاب في هذا الصف: {students.length}</p>
        )}
      </div>

      {/* نموذج إضافة طالب */}
      {showAdd && selectedClassId && (
        <div className="card mb-4 fade-in">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم الطالب الكامل"
              className="input-field"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && addStudent()}
            />
            <div className="flex gap-2">
              <button onClick={addStudent} className="btn-success">
                <Save className="w-4 h-4" />
                حفظ
              </button>
              <button onClick={() => { setShowAdd(false); setNewName(''); }} className="btn-secondary">
                <X className="w-4 h-4" />
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* قسم الاستيراد */}
      {showImport && selectedClassId && (
        <div className="card mb-4 fade-in">
          <h3 className="font-bold text-gray-800 mb-3">استيراد الأسماء إلى صف: {selectedClassName}</h3>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setImportMode('paste')}
              className={importMode === 'paste' ? 'btn-primary' : 'btn-secondary'}
            >
              <ClipboardPaste className="w-4 h-4" />
              نسخ ولصق الأسماء
            </button>
            <button
              onClick={() => setImportMode('excel')}
              className={importMode === 'excel' ? 'btn-primary' : 'btn-secondary'}
            >
              <FileSpreadsheet className="w-4 h-4" />
              استيراد من إكسل
            </button>
          </div>

          {importMode === 'paste' ? (
            <div className="space-y-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="الصق الأسماء هنا، كل اسم في سطر منفصل..."
                className="input-field min-h-[150px] resize-y"
                rows={6}
              />
              <div className="flex gap-2">
                <button onClick={handlePasteImport} className="btn-primary">
                  <Upload className="w-4 h-4" />
                  معاينة الأسماء
                </button>
                <button onClick={() => { setShowImport(false); setPasteText(''); }} className="btn-secondary">
                  <X className="w-4 h-4" />
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#CE1126] hover:bg-red-50/30 transition-all"
              >
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-semibold">اضغط لاختيار ملف إكسل</p>
                <p className="text-sm text-gray-400 mt-1">يتم قراءة الأسماء من العمود الأول</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleExcelImport(file);
                }}
              />
              <button onClick={() => { setShowImport(false); }} className="btn-secondary">
                <X className="w-4 h-4" />
                إلغاء
              </button>
            </div>
          )}
        </div>
      )}

      {/* معاينة الأسماء المستوردة */}
      {importPreview && (
        <div className="card mb-4 fade-in">
          <h3 className="font-bold text-gray-800 mb-3">
            معاينة الأسماء ({importNames.length} طالب)
          </h3>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 mb-3">
            <ol className="space-y-1">
              {importNames.map((name, idx) => (
                <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                  <span className="text-gray-400 font-bold w-6">{idx + 1}.</span>
                  {name}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex gap-2">
            <button onClick={confirmImport} className="btn-success">
              <Save className="w-4 h-4" />
              تأكيد الإضافة ({importNames.length} طالب)
            </button>
            <button onClick={() => { setImportPreview(false); setImportNames([]); }} className="btn-secondary">
              <X className="w-4 h-4" />
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* قائمة الطلاب */}
      {!selectedClassId ? (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">يرجى اختيار صف لعرض الطلاب</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-gray-500">جارٍ تحميل الطلاب...</div>
      ) : students.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">لا يوجد طلاب في هذا الصف بعد. اضغط على «إضافة طالب» أو «استيراد أسماء» للبدء.</p>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-600">
                  <th className="text-right py-2 px-3 font-semibold w-12">الرقم</th>
                  <th className="text-right py-2 px-3 font-semibold">اسم الطالب</th>
                  <th className="text-center py-2 px-3 font-semibold w-24">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => (
                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3 text-gray-500 font-semibold">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      {editingId === student.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="input-field"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateStudent(student.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                      ) : (
                        <span className="font-semibold text-gray-800">{student.name}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-center gap-1">
                        {editingId === student.id ? (
                          <>
                            <button onClick={() => updateStudent(student.id)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" aria-label="حفظ">
                              <Save className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors" aria-label="إلغاء">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditingId(student.id); setEditName(student.name); }}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                              aria-label="تعديل"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(student)}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                              aria-label="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* تأكيد الحذف */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">تأكيد الحذف</h2>
            </div>
            <p className="text-gray-600 mb-2">
              هل أنت متأكد من حذف الطالب «{deleteConfirm.name}»؟
            </p>
            <p className="text-sm text-red-600 mb-6">
              سيتم حذف جميع سجلات الحضور والغياب المرتبطة بهذا الطالب نهائيًا.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">إلغاء</button>
              <button onClick={() => deleteStudent(deleteConfirm.id)} className="btn-danger">
                <Trash2 className="w-4 h-4" />
                نعم، احذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
