import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/discipline/auth';
import { Modal } from '@/components/discipline/ui';

const MIN_LENGTH = 8;

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { show } = useToast();
  const { session } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (next.length < MIN_LENGTH) return setErr(`كلمة المرور الجديدة يجب ألا تقل عن ${MIN_LENGTH} أحرف`);
    if (next !== confirm) return setErr('تأكيد كلمة المرور غير مطابق');
    if (next === current) return setErr('كلمة المرور الجديدة مطابقة للحالية');
    const email = session?.user.email;
    if (!email) return setErr('تعذر تحديد الحساب، أعد تسجيل الدخول');

    setBusy(true);
    // التحقق من كلمة المرور الحالية قبل التغيير
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      setBusy(false);
      return setErr('كلمة المرور الحالية غير صحيحة');
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) return setErr('تعذر تغيير كلمة المرور: ' + error.message);
    show('تم تغيير كلمة المرور بنجاح', 'success');
    onClose();
  }

  return (
    <Modal title="تغيير كلمة المرور" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="block text-sm font-semibold text-gray-700 mb-1">كلمة المرور الحالية</span>
          <input className="input-field" type="password" dir="ltr" required autoFocus autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-gray-700 mb-1">كلمة المرور الجديدة</span>
          <input className="input-field" type="password" dir="ltr" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <span className="block text-xs text-gray-500 mt-1">{MIN_LENGTH} أحرف على الأقل</span>
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-gray-700 mb-1">تأكيد كلمة المرور الجديدة</span>
          <input className="input-field" type="password" dir="ltr" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'جارٍ التغيير...' : 'تغيير كلمة المرور'}</button>
        </div>
      </form>
    </Modal>
  );
}
