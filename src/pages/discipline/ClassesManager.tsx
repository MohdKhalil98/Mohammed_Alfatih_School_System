import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useDiscipline } from '@/lib/discipline/data';
import { STAGES } from '@/lib/discipline/constants';
import type { ClassX } from '@/lib/discipline/types';
import { ConfirmModal, dbError } from '@/components/discipline/ui';

type Draft = { name: string; stage: string; grade: string };

export default function ClassesManager({ editable }: { editable: boolean }) {
  const { show } = useToast();
  const { classes, reload } = useDiscipline();
  const [add, setAdd] = useState<Draft>({ name: '', stage: '', grade: '' });
  const [removing, setRemoving] = useState<{ cls: ClassX; students: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function addClass() {
    const name = add.name.trim();
    if (!name) return show('أدخل اسم الصف', 'warning');
    if (classes.some((c) => c.name === name)) return show('يوجد صف بهذا الاسم', 'warning');
    setBusy(true);
    const nextOrder = classes.reduce((m, c) => Math.max(m, c.order_index), 0) + 1;
    const { error } = await supabase.from('classes').insert({
      name, stage: add.stage || null, grade_level: add.grade.trim() || null, order_index: nextOrder,
    });
    setBusy(false);
    if (error) return show(dbError(error), 'error');
    setAdd({ name: '', stage: '', grade: '' });
    show('تمت إضافة الصف', 'success');
    reload();
  }

  async function saveClass(c: ClassX, d: Draft) {
    const name = d.name.trim();
    if (!name) return show('اسم الصف مطلوب', 'warning');
    if (classes.some((x) => x.id !== c.id && x.name === name)) return show('يوجد صف بهذا الاسم', 'warning');
    const { error } = await supabase
      .from('classes')
      .update({ name, stage: d.stage || null, grade_level: d.grade.trim() || null })
      .eq('id', c.id);
    if (error) return show(dbError(error), 'error');
    show('تم حفظ الصف', 'success');
    reload();
  }

  async function askRemove(c: ClassX) {
    const { count } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('class_id', c.id);
    setRemoving({ cls: c, students: count ?? 0 });
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    const { error } = await supabase.from('classes').delete().eq('id', removing.cls.id);
    setBusy(false);
    setRemoving(null);
    if (error) return show(dbError(error), 'error');
    show('تم حذف الصف', 'success');
    reload();
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-bold">المراحل والصفوف</h2>
        <p className="text-sm text-gray-600">أضف الصفوف وعدّلها واحذفها. المرحلة والصف الدراسي يحدّدان نطاق انطباق المخالفات.</p>
      </div>

      {editable && (
        <div className="grid sm:grid-cols-4 gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <input className="input-field" placeholder="اسم الصف (مثال: أول إعدادي 1)" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          <select className="input-field" value={add.stage} onChange={(e) => setAdd({ ...add, stage: e.target.value })}>
            <option value="">المرحلة</option>
            {STAGES.map((x) => <option key={x}>{x}</option>)}
          </select>
          <input className="input-field" placeholder="الصف الدراسي (مثال: الأول الإعدادي)" value={add.grade} onChange={(e) => setAdd({ ...add, grade: e.target.value })} />
          <button className="btn-primary" onClick={addClass} disabled={busy}>
            <Plus className="w-4 h-4" /> إضافة صف
          </button>
        </div>
      )}

      <div className="space-y-2">
        {classes.length === 0 && <p className="text-sm text-gray-500">لا توجد صفوف.</p>}
        {classes.map((c) => (
          <ClassRow key={c.id} cls={c} editable={editable} onSave={saveClass} onDelete={askRemove} />
        ))}
      </div>

      {removing && (
        <ConfirmModal
          title="حذف الصف"
          confirmLabel="حذف نهائي"
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={confirmRemove}
          message={
            <>
              سيُحذف الصف «{removing.cls.name}»
              {removing.students > 0 ? (
                <> مع <b>{removing.students}</b> طالبًا وجميع سجلات حضورهم نهائيًا.</>
              ) : (
                <>.</>
              )}{' '}
              إن كان لأحد طلابه وقائع انضباط فلن يُحذف. ولا يمكن التراجع، فخذ نسخة احتياطية قبل ذلك.
            </>
          }
        />
      )}
    </section>
  );
}

function ClassRow({
  cls, editable, onSave, onDelete,
}: { cls: ClassX; editable: boolean; onSave: (c: ClassX, d: Draft) => void; onDelete: (c: ClassX) => void }) {
  const [d, setD] = useState<Draft>({ name: cls.name, stage: cls.stage ?? '', grade: cls.grade_level ?? '' });
  const dirty = d.name !== cls.name || d.stage !== (cls.stage ?? '') || d.grade !== (cls.grade_level ?? '');
  return (
    <div className="grid sm:grid-cols-[1.2fr_1fr_1.2fr_auto] gap-2 items-center">
      <input className="input-field" disabled={!editable} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      <select className="input-field" disabled={!editable} value={d.stage} onChange={(e) => setD({ ...d, stage: e.target.value })}>
        <option value="">المرحلة</option>
        {STAGES.map((x) => <option key={x}>{x}</option>)}
      </select>
      <input className="input-field" disabled={!editable} placeholder="الصف الدراسي" value={d.grade} onChange={(e) => setD({ ...d, grade: e.target.value })} />
      {editable && (
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={!dirty} onClick={() => onSave(cls, d)} title="حفظ">
            <Save className="w-4 h-4" /> حفظ
          </button>
          <button className="btn-secondary !text-red-600" onClick={() => onDelete(cls)} title="حذف" aria-label="حذف الصف">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
