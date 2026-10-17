import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const VIEW_AS_KEY = 'view-as-role';

// وضع «المشرف» لمدير النظام: يُرسل مع كل طلب فتقيّد قاعدة البيانات البيانات بصفوفه
// (يُقرأ في الدالة active_role). لا أثر له على من ليس مدير نظام.
export function getViewAs(): 'supervisor' | null {
  try {
    return localStorage.getItem(VIEW_AS_KEY) === 'supervisor' ? 'supervisor' : null;
  } catch {
    return null;
  }
}

export function storeViewAs(role: 'supervisor' | null) {
  try {
    if (role) localStorage.setItem(VIEW_AS_KEY, role);
    else localStorage.removeItem(VIEW_AS_KEY);
  } catch {
    /* التخزين المحلي اختياري */
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) => {
      const mode = getViewAs();
      if (!mode) return fetch(input, init);
      const headers = new Headers(init?.headers);
      headers.set('x-view-as', mode);
      return fetch(input, { ...init, headers });
    },
  },
});
