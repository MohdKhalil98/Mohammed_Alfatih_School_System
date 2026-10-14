import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Search, X } from 'lucide-react';
import { useDiscipline } from '@/lib/discipline/data';
import type { StudentX } from '@/lib/discipline/types';

export function PageTitle({ icon, title, sub, actions }: { icon: ReactNode; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
      <div className="flex items-center gap-3">
        <div className="bg-red-50 p-2.5 rounded-lg text-[#CE1126]">{icon}</div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{title}</h1>
          {sub && <p className="text-sm text-gray-500">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

export function CategoryBadge({ id }: { id: number }) {
  const { categoryOf } = useDiscipline();
  const c = categoryOf(id);
  if (!c) return null;
  // اللون وحده لا يدل على الخطورة: الرمز والاسم ظاهران دائمًا
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border"
      style={{ color: c.color, borderColor: c.color, backgroundColor: c.color + '14' }}
    >
      <span aria-hidden>{c.symbol}</span>
      {c.name}
    </span>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700 border-gray-300',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    amber: 'bg-amber-50 text-amber-700 border-amber-300',
    red: 'bg-red-50 text-red-700 border-red-300',
    blue: 'bg-blue-50 text-blue-700 border-blue-300',
  };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold border ${tones[tone]}`}>{children}</span>;
}

export function Notice({ tone = 'amber', children }: { tone?: 'amber' | 'blue' | 'red'; children: ReactNode }) {
  const tones = {
    amber: 'bg-amber-50 border-amber-300 text-amber-800',
    blue: 'bg-blue-50 border-blue-300 text-blue-800',
    red: 'bg-red-50 border-red-300 text-red-800',
  };
  return (
    <div className={`border rounded-lg p-3 text-sm flex gap-2 items-start no-print ${tones[tone]}`}>
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print" role="dialog" aria-modal="true">
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto p-5 fade-in`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title, message, confirmLabel = 'تأكيد', onConfirm, onCancel, busy,
}: { title: string; message: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="text-sm text-gray-600 mb-5">{message}</div>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onCancel}>إلغاء</button>
        <button className="btn-primary" onClick={onConfirm} disabled={busy}>{busy ? 'جارٍ التنفيذ...' : confirmLabel}</button>
      </div>
    </Modal>
  );
}

// بحث فوري عن الطالب بالاسم أو الرقم المدرسي
export function StudentPicker({
  value, onChange, label = 'الطالب',
}: { value: string | null; onChange: (id: string | null) => void; label?: string }) {
  const { students, classOf } = useDiscipline();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = students.find((s) => s.id === value);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const results = useMemo(() => {
    const t = q.trim();
    if (!t) return [] as StudentX[];
    return students.filter((s) => s.name.includes(t) || (s.school_number ?? '').includes(t)).slice(0, 12);
  }, [q, students]);

  if (selected) {
    const cls = classOf(selected.class_id);
    return (
      <div>
        <span className="block text-sm font-semibold text-gray-700 mb-1">{label}</span>
        <div className="flex items-center justify-between gap-2 border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-2">
          <div className="text-sm">
            <p className="font-bold text-gray-800">{selected.name}</p>
            <p className="text-gray-600 text-xs">
              الرقم المدرسي: {selected.school_number || 'غير مسجل'} — الصف: {cls?.grade_level || '—'} — الفصل: {cls?.name || '—'}
            </p>
          </div>
          <button className="btn-secondary !py-1 !px-2" onClick={() => onChange(null)} type="button">تغيير</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <span className="block text-sm font-semibold text-gray-700 mb-1">{label}</span>
      <div className="relative">
        <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-gray-400" />
        <input
          className="input-field !pr-9"
          placeholder="ابحث بالاسم أو الرقم المدرسي"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && q.trim() && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.length === 0 && <p className="p-3 text-sm text-gray-500">لا توجد نتائج</p>}
          {results.map((s) => (
            <button
              type="button"
              key={s.id}
              className="w-full text-right px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
              onClick={() => {
                onChange(s.id);
                setOpen(false);
                setQ('');
              }}
            >
              <span className="font-semibold text-sm">{s.name}</span>
              <span className="text-xs text-gray-500 mr-2">
                {classOf(s.class_id)?.name} {s.school_number ? `— ${s.school_number}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s);
  return d.toLocaleDateString('ar-BH-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ترجمة أخطاء قاعدة البيانات إلى رسائل عربية مفهومة
export function dbError(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return 'حدث خطأ غير متوقع';
  if (e.code === '23505') return 'السجل مكرر: توجد واقعة أو رقم مطابق مسجل مسبقًا';
  if (e.code === '23503') return 'لا يمكن تنفيذ العملية لوجود سجلات مرتبطة بهذا السجل';
  if (e.code === '42501' || /row-level security|permission denied/i.test(e.message ?? '')) return 'ليست لديك صلاحية لتنفيذ هذه العملية';
  if (e.message && /[؀-ۿ]/.test(e.message)) return e.message; // رسائل المشغلات العربية
  return 'تعذر الحفظ: ' + (e.message ?? 'خطأ غير معروف');
}
