import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { ClassRow } from '@/lib/types';
import { Plus, Edit2, Trash2, Save, X, BookOpen, AlertTriangle } from 'lucide-react';

export default function Classes() {
  const { show } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<ClassRow | null>(null);

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    setLoading(true);
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, order_index, created_at')
      .order('order_index', { ascending: true });
    if (error) {
      show('فشل في تحميل الصفوف', 'error');
    } else {
      setClasses(data || []);
    }
    setLoading(false);
  }

  async function addClass() {
    if (!newName.trim()) {
      show('يرجى إدخال اسم الصف', 'warning');
      return;
    }
    const maxOrder = classes.length > 0 ? Math.max(...classes.map((c) => c.order_index)) : 0;
    const { error } = await supabase
      .from('classes')
      .insert({ name: newName.trim(), order_index: maxOrder + 1 });
    if (error) {
      show('فشل في إضافة الصف', 'error');
    } else {
      show('تمت إضافة الصف بنجاح', 'success');
      setNewName('');
      setShowAdd(false);
      loadClasses();
    }
  }

  async function updateClass(id: string) {
    if (!editName.trim()) {
      show('يرجى إدخال اسم الصف', 'warning');
      return;
    }
    const { error } = await supabase
      .from('classes')
      .update({ name: editName.trim() })
      .eq('id', id);
    if (error) {
      show('فشل في تعديل الصف', 'error');
    } else {
      show('تم تعديل الصف بنجاح', 'success');
      setEditingId(null);
      loadClasses();
    }
  }

  async function deleteClass(id: string) {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) {
      show('فشل في حذف الصف', 'error');
    } else {
      show('تم حذف الصف وجميع الطلاب المرتبطين به', 'success');
      setDeleteConfirm(null);
      loadClasses();
    }
  }


  return (
    <div className="max-w-5xl mx-auto px-4 py-6 fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#CE1126]/10 p-2.5 rounded-lg">
            <BookOpen className="w-6 h-6 text-[#CE1126]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">إدارة الصفوف</h1>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          إضافة صف
        </button>
      </div>

      {/* نموذج إضافة صف */}
      {showAdd && (
        <div className="card mb-4 fade-in">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم الصف الجديد (مثال: ثاني إعدادي 7)"
              className="input-field"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && addClass()}
            />
            <div className="flex gap-2">
              <button onClick={addClass} className="btn-success">
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

      {/* قائمة الصفوف */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">جارٍ تحميل البيانات...</div>
      ) : classes.length === 0 ? (
        <div className="card text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">لا توجد صفوف مضافة بعد. اضغط على «إضافة صف» للبدء.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((cls, index) => (
            <div key={cls.id} className="card flex items-center justify-between group hover:shadow-md transition-all">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-lg bg-[#CE1126]/10 flex items-center justify-center font-bold text-[#CE1126] text-lg">
                  {index + 1}
                </div>
                {editingId === cls.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-field flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') updateClass(cls.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <div>
                    <p className="font-bold text-gray-800">{cls.name}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {editingId === cls.id ? (
                  <>
                    <button onClick={() => updateClass(cls.id)} className="btn-success text-xs px-3 py-1.5">
                      <Save className="w-3.5 h-3.5" />
                      حفظ
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5">
                      <X className="w-3.5 h-3.5" />
                      إلغاء
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingId(cls.id); setEditName(cls.name); }}
                      className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                      aria-label="تعديل"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(cls)}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
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
              هل أنت متأكد من حذف الصف «{deleteConfirm.name}»؟
            </p>
            <p className="text-sm text-red-600 mb-6">
              سيتم حذف جميع الطلاب وسجلات الحضور المرتبطة بهذا الصف نهائيًا.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary"
              >
                إلغاء
              </button>
              <button
                onClick={() => deleteClass(deleteConfirm.id)}
                className="btn-danger"
              >
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
