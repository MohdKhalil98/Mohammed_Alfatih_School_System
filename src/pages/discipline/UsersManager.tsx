import { useCallback, useEffect, useState } from 'react';
import { Save, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/discipline/auth';
import { useDiscipline } from '@/lib/discipline/data';
import { ROLE_LABELS } from '@/lib/discipline/constants';
import type { Profile, Role } from '@/lib/discipline/types';
import { Badge, Field, Notice, dbError } from '@/components/discipline/ui';

type UserRow = Profile & { email: string | null };

const ROLE_SUMMARY: Record<Role, string[]> = {
  admin: [
    'كل الصفوف والطلاب والحضور والمخالفات',
    'إدارة الصفوف والطلاب، والإعدادات، وقاعدة المخالفات',
    'النسخ الاحتياطي وسجل التدقيق',
    'إدارة الحسابات وتعيين صفوف المشرفين',
    'يمكنه التبديل إلى «وضع المشرف» من الشريط الجانبي ليرى الصفوف المعيَّنة له أدناه فقط',
  ],
  supervisor: [
    'يتابع ويسجّل (حضور، وقائع، إجراءات، استدعاءات) لصفوفه المعيَّنة فقط',
    'لا يرى أي بيانات خارج صفوفه',
    'لا يدير الصفوف أو الطلاب أو الإعدادات أو الحسابات',
  ],
};

export default function UsersManager() {
  const { show } = useToast();
  const { session } = useAuth();
  const { classes } = useDiscipline();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [assigned, setAssigned] = useState<Record<string, string[]>>({});
  const [newUser, setNewUser] = useState({ email: '', name: '', role: 'supervisor' as Role });

  const load = useCallback(async () => {
    const p = await supabase.from('profiles').select('user_id, full_name, role, active, email').order('full_name');
    setUsers((p.data ?? []) as UserRow[]);
    const sc = await supabase.from('supervisor_classes').select('user_id, class_id');
    const map: Record<string, string[]> = {};
    for (const r of (sc.data ?? []) as { user_id: string; class_id: string }[]) {
      (map[r.user_id] ??= []).push(r.class_id);
    }
    setAssigned(map);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function update(u: UserRow, patch: Partial<UserRow>, okMsg?: string) {
    const { error } = await supabase.from('profiles').update(patch).eq('user_id', u.user_id);
    if (error) return show(dbError(error), 'error');
    if (okMsg) show(okMsg, 'success');
    load();
  }

  async function setClasses(userId: string, classIds: string[], on: boolean) {
    const res = on
      ? await supabase.from('supervisor_classes').upsert(classIds.map((class_id) => ({ user_id: userId, class_id })), { onConflict: 'user_id,class_id', ignoreDuplicates: true })
      : await supabase.from('supervisor_classes').delete().eq('user_id', userId).in('class_id', classIds);
    if (res.error) return show(dbError(res.error), 'error');
    load();
  }

  async function addUser() {
    if (!newUser.email.trim() || !newUser.name.trim()) return show('أدخل البريد والاسم الكامل', 'warning');
    const { error } = await supabase.rpc('admin_add_profile', {
      p_email: newUser.email.trim(), p_name: newUser.name.trim(), p_role: newUser.role,
    });
    if (error) return show(dbError(error), 'error');
    show('تمت إضافة صلاحية المستخدم', 'success');
    setNewUser({ email: '', name: '', role: 'supervisor' });
    load();
  }

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-bold">المستخدمون والأدوار</h2>
        <p className="text-sm text-gray-600">لكل حساب اسم كامل ودور وحالة. المشرف الإداري يرى صفوفه المعيَّنة فقط.</p>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <UserCard
            key={u.user_id}
            user={u}
            isSelf={u.user_id === session?.user.id}
            classes={classes}
            assigned={assigned[u.user_id] ?? []}
            onUpdate={update}
            onSetClasses={setClasses}
          />
        ))}
      </div>

      <div className="border-t pt-3 space-y-2">
        <h3 className="font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4" /> إضافة مستخدم</h3>
        <Notice tone="blue">
          أنشئ الحساب أولًا من Supabase (Authentication ← Users ← Add user ← Create new user، مع تفعيل Auto Confirm User)، ثم اربطه هنا بالبريد نفسه.
        </Notice>
        <div className="grid sm:grid-cols-4 gap-2">
          <input className="input-field" dir="ltr" placeholder="البريد الإلكتروني" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
          <input className="input-field" placeholder="الاسم الكامل" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
          <select className="input-field" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button className="btn-primary" onClick={addUser}>ربط المستخدم</button>
        </div>
      </div>
    </section>
  );
}

function UserCard({
  user, isSelf, classes, assigned, onUpdate, onSetClasses,
}: {
  user: UserRow;
  isSelf: boolean;
  classes: { id: string; name: string }[];
  assigned: string[];
  onUpdate: (u: UserRow, patch: Partial<UserRow>, okMsg?: string) => void;
  onSetClasses: (userId: string, classIds: string[], on: boolean) => void;
}) {
  const [name, setName] = useState(user.full_name);
  const nameDirty = name.trim() !== user.full_name;
  const allIds = classes.map((c) => c.id);

  return (
    <div className={`border rounded-xl p-4 space-y-3 ${user.active ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-80'}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[#CE1126] text-white flex items-center justify-center font-bold flex-shrink-0">
          {user.full_name.trim().charAt(0)}
        </div>
        <div className="flex-1 min-w-[14rem] space-y-1">
          <div className="flex gap-2">
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" />
            <button
              className="btn-secondary"
              disabled={!nameDirty || !name.trim()}
              onClick={() => onUpdate(user, { full_name: name.trim() }, 'تم حفظ الاسم')}
            >
              <Save className="w-4 h-4" /> حفظ
            </button>
          </div>
          <p className="text-xs text-gray-500" dir="ltr" style={{ textAlign: 'right' }}>{user.email ?? 'البريد غير مسجل'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Field label="الدور">
            <select
              className="input-field !w-auto"
              disabled={isSelf}
              value={user.role}
              onChange={(e) => onUpdate(user, { role: e.target.value as Role }, 'تم تغيير الدور')}
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm mt-5">
            <input
              type="checkbox"
              disabled={isSelf}
              checked={user.active}
              onChange={(e) => onUpdate(user, { active: e.target.checked }, e.target.checked ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب')}
            />
            مفعّل
          </label>
        </div>
      </div>

      {isSelf && <p className="text-xs text-gray-500">هذا حسابك: لا يمكنك تغيير دورك أو تعطيل حسابك حتى لا تفقد صلاحية الإدارة.</p>}

      <ul className="text-xs text-gray-600 list-disc pr-5 space-y-0.5">
        {ROLE_SUMMARY[user.role].map((t) => <li key={t}>{t}</li>)}
      </ul>

      {(
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {user.role === 'admin' ? 'صفوف وضع المشرف' : 'الصفوف التابعة'} <Badge tone={assigned.length ? 'blue' : 'amber'}>{assigned.length} من {classes.length}</Badge>
            </p>
            <div className="flex gap-3 text-xs">
              <button className="text-blue-700 underline" onClick={() => onSetClasses(user.user_id, allIds, true)}>تحديد الكل</button>
              <button className="text-gray-600 underline" onClick={() => onSetClasses(user.user_id, allIds, false)}>إلغاء الكل</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => {
              const on = assigned.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-lg border cursor-pointer ${
                    on ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-gray-300 text-gray-600'
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={(e) => onSetClasses(user.user_id, [c.id], e.target.checked)} />
                  {c.name}
                </label>
              );
            })}
          </div>
          {assigned.length === 0 && (
            <p className="text-xs text-amber-700">
              {user.role === 'admin' ? 'لم تُحدَّد صفوف، فلن يرى هذا الحساب أي بيانات عند التبديل إلى وضع المشرف.' : 'لم تُحدَّد صفوف، فلن يرى هذا المشرف أي بيانات.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
