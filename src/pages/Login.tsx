import { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/discipline/auth';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(await signIn(email.trim(), password));
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 fade-in">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-l from-[#CE1126] to-[#a00d1f] text-white text-center rounded-t-2xl px-6 py-6">
          <p className="text-xs font-semibold opacity-90">مملكة البحرين</p>
          <p className="text-xs font-semibold opacity-90">وزارة التربية والتعليم</p>
          <p className="text-lg font-bold mt-1">مدرسة أحمد الفاتح الإعدادية للبنين</p>
          <div className="h-0.5 w-14 bg-white/40 mx-auto my-2" />
          <p className="text-sm font-bold">سجل الحضور والغياب الطلابي</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-b-2xl shadow-sm border border-gray-200 border-t-0 p-6 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">تسجيل الدخول</h1>
            <p className="text-sm text-gray-500 mt-1">أدخل بيانات حسابك للوصول إلى النظام</p>
          </div>

          <label className="block">
            <span className="block text-sm font-semibold text-gray-700 mb-1">البريد الإلكتروني</span>
            <input
              className="input-field"
              type="email"
              dir="ltr"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-semibold text-gray-700 mb-1">كلمة المرور</span>
            <div className="relative">
              <input
                className="input-field pl-10"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </label>

          {err && <p className="text-sm text-red-600" role="alert">{err}</p>}

          <button className="btn-primary w-full py-2.5" disabled={busy}>
            <LogIn className="w-4 h-4" />
            {busy ? 'جارٍ الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
