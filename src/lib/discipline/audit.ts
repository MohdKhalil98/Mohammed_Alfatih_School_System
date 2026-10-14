import { supabase } from '@/lib/supabase';

// أحداث الطباعة والتصدير تُسجَّل من الواجهة (INSERT/UPDATE تُسجَّل بمشغلات قاعدة البيانات)
export async function logEvent(
  operation: 'PRINT' | 'EXPORT' | 'LOGIN' | 'BACKUP',
  details: string,
  who?: { name?: string; role?: string },
  tableName?: string,
  rowId?: string
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      operation,
      details,
      user_name: who?.name ?? null,
      actor_role: who?.role ?? null,
      table_name: tableName ?? null,
      row_id: rowId ?? null,
    });
  } catch {
    // فشل التدقيق لا يمنع الطباعة؛ يُسجَّل في وحدة التحكم فقط
    console.warn('تعذر تسجيل حدث التدقيق');
  }
}
