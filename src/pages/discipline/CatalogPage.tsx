import { useMemo, useState } from 'react';
import { Library, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useDiscipline } from '@/lib/discipline/data';
import { ACTION_LABELS, STAGES, can } from '@/lib/discipline/constants';
import type { ActionType, Violation } from '@/lib/discipline/types';
import { Badge, CategoryBadge, Field, Modal, Notice, PageTitle, dbError, today } from '@/components/discipline/ui';
import type { PageProps } from './props';

export default function CatalogPage({ role }: PageProps) {
  const { categories, violations, categoryOf, reload } = useDiscipline();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [editing, setEditing] = useState<Violation | 'new' | null>(null);

  const rows = useMemo(
    () =>
      violations.filter(
        (v) =>
          (showOld || v.status !== 'superseded') &&
          (!cat || v.category_id === Number(cat)) &&
          (!q || v.official_name.includes(q) || v.code.toLowerCase().includes(q.toLowerCase()) || (v.article ?? '').includes(q) || (v.clause ?? '').includes(q))
      ),
    [violations, q, cat, showOld]
  );
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 fade-in">
      <PageTitle
        icon={<Library className="w-6 h-6" />}
        title="قاعدة المخالفات الرسمية"
        sub="لائحة الانضباط الطلابي — القرار رقم (279) لسنة 2025"
        actions={can.settings(role) && <button className="btn-primary" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> مخالفة جديدة</button>}
      />
      <div className="card mb-4 grid sm:grid-cols-4 gap-3 no-print">
        <input className="input-field sm:col-span-2" placeholder="بحث بالاسم أو الرمز أو رقم المادة/البند" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input-field" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">كل الفئات</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.symbol} {c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} /> إظهار الإصدارات القديمة</label>
      </div>

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-2 text-right">الرمز</th>
              <th className="p-2 text-right">المخالفة</th>
              <th className="p-2 text-right">الفئة</th>
              <th className="p-2 text-right">المادة / البند</th>
              <th className="p-2 text-right">الحالة</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-t border-gray-100 align-top">
                <td className="p-2 font-mono text-xs">{v.code} <span className="text-gray-400">v{v.version}</span></td>
                <td className="p-2">{v.official_name}</td>
                <td className="p-2"><CategoryBadge id={v.category_id} /></td>
                <td className="p-2">{categoryOf(v.category_id)?.article}{v.clause ? ` — ${v.clause}` : ' — (البند غير مدخل)'}</td>
                <td className="p-2">
                  <Badge tone={v.status === 'verified' ? 'green' : v.status === 'superseded' ? 'gray' : 'amber'}>
                    {v.status === 'superseded' ? 'إصدار قديم' : 'ساري'}
                  </Badge>
                </td>
                <td className="p-2 whitespace-nowrap no-print">
                  <button className="text-blue-700 underline ml-2" onClick={() => setEditing(v)}>{can.settings(role) ? 'تفاصيل / تحديث' : 'تفاصيل'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <VersionForm
          initial={editing === 'new' ? null : editing}
          canEdit={can.settings(role)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function VersionForm({ initial, canEdit, onClose, onSaved }: { initial: Violation | null; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const { categories, violations } = useDiscipline();
  const [f, setF] = useState({
    category_id: String(initial?.category_id ?? 1),
    article: initial?.article ?? '',
    clause: initial?.clause ?? '',
    official_name: initial?.official_name ?? '',
    description: initial?.description ?? '',
    reference_text: initial?.reference_text ?? '',
    allowed_remedies: initial?.allowed_remedies ?? ([] as string[]),
    remedy_conditions: initial?.remedy_conditions ?? '',
    applicable_stages: initial?.applicable_stages ?? ([] as string[]),
    approval_requirements: initial?.approval_requirements ?? '',
    source: initial?.source ?? 'نص اللائحة الرسمية — القرار 279/2025',
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (k: 'allowed_remedies' | 'applicable_stages', val: string) =>
    setF((p) => ({ ...p, [k]: p[k].includes(val) ? p[k].filter((x) => x !== val) : [...p[k], val] }));

  async function save() {
    if (!f.official_name.trim()) return show('أدخل الاسم الرسمي للمخالفة', 'warning');
    const catId = Number(f.category_id);
    const payload = {
      category_id: catId,
      article: f.article || null, clause: f.clause || null,
      official_name: f.official_name.trim(),
      description: f.description || null,
      reference_text: f.reference_text || null,
      allowed_remedies: f.allowed_remedies,
      remedy_conditions: f.remedy_conditions || null,
      applicable_stages: f.applicable_stages,
      approval_requirements: f.approval_requirements || null,
      source: f.source || null,
      status: 'verified' as const,
      last_reviewed: today(),
    };
    if (!initial) {
      const n = violations.filter((v) => v.category_id === catId).length + 1;
      let code = `F${catId}-${String(n).padStart(3, '0')}`;
      while (violations.some((v) => v.code === code)) code = `F${catId}-${String(Number(code.slice(3)) + 1).padStart(3, '0')}`;
      const { error } = await supabase.from('violations_catalog').insert({ ...payload, code, version: 1 });
      if (error) return show(dbError(error), 'error');
    } else {
      // تحديث = إصدار جديد؛ يبقى القديم محفوظًا ومرتبطًا بالوقائع السابقة
      const { error } = await supabase.from('violations_catalog').insert({ ...payload, code: initial.code, version: initial.version + 1 });
      if (error) return show(dbError(error), 'error');
      const { error: e2 } = await supabase.from('violations_catalog').update({ status: 'superseded' }).eq('id', initial.id);
      if (e2) return show(dbError(e2), 'error');
    }
    show('تم الحفظ', 'success');
    onSaved();
  }

  return (
    <Modal title={initial ? `${initial.code} — إصدار ${initial.version}` : 'مخالفة جديدة'} onClose={onClose} wide>
      <div className="space-y-3 text-sm">
        {canEdit && initial && <Notice tone="blue">الحفظ ينشئ إصدارًا جديدًا ويُبقي الإصدار الحالي في السجل دون فقد الوقائع المرتبطة به.</Notice>}
        <fieldset disabled={!canEdit} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="الفئة">
              <select className="input-field" value={f.category_id} onChange={(e) => set('category_id', e.target.value)} disabled={!!initial}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.symbol} {c.name}</option>)}
              </select>
            </Field>
            <Field label="رقم المادة"><input className="input-field" value={f.article} onChange={(e) => set('article', e.target.value)} /></Field>
            <Field label="رقم البند"><input className="input-field" value={f.clause} onChange={(e) => set('clause', e.target.value)} /></Field>
          </div>
          <Field label="الاسم الرسمي" required><input className="input-field" value={f.official_name} onChange={(e) => set('official_name', e.target.value)} /></Field>
          <Field label="وصف توضيحي مختصر"><textarea className="input-field" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="النص المرجعي (مقتطف دقيق من اللائحة)"><textarea className="input-field" rows={3} value={f.reference_text} onChange={(e) => set('reference_text', e.target.value)} /></Field>
          <Field label="المعالجات المسموح بها (حسب نص اللائحة)">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(Object.keys(ACTION_LABELS) as ActionType[]).map((k) => (
                <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={f.allowed_remedies.includes(k)} onChange={() => toggle('allowed_remedies', k)} />{ACTION_LABELS[k]}</label>
              ))}
            </div>
          </Field>
          <Field label="شروط تطبيق المعالجة"><textarea className="input-field" rows={2} value={f.remedy_conditions} onChange={(e) => set('remedy_conditions', e.target.value)} /></Field>
          <Field label="المراحل المنطبقة (بدون اختيار = كل المراحل)">
            <div className="flex gap-4">
              {STAGES.map((s) => <label key={s} className="flex items-center gap-1"><input type="checkbox" checked={f.applicable_stages.includes(s)} onChange={() => toggle('applicable_stages', s)} />{s}</label>)}
            </div>
          </Field>
          <Field label="متطلبات الإحالة أو الاعتماد"><input className="input-field" value={f.approval_requirements} onChange={(e) => set('approval_requirements', e.target.value)} /></Field>
          <Field label="مصدر المعلومات"><input className="input-field" value={f.source} onChange={(e) => set('source', e.target.value)} /></Field>
        </fieldset>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>إغلاق</button>
          {canEdit && <button className="btn-primary" onClick={save}>{initial ? 'حفظ كإصدار جديد' : 'إضافة'}</button>}
        </div>
      </div>
    </Modal>
  );
}
