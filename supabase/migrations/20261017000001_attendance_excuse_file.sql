/*
  # مرفق العذر الرسمي للغياب بعذر

  - عمود excuse_file_path في جدول attendance لمسار الملف المرفق.
  - حاوية تخزين attendance-excuses (خاصة) بنفس نمط سياسات الحضور المفتوحة.
*/

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS excuse_file_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-excuses', 'attendance-excuses', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_select_attendance_excuses" ON storage.objects;
CREATE POLICY "anon_select_attendance_excuses" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'attendance-excuses');

DROP POLICY IF EXISTS "anon_insert_attendance_excuses" ON storage.objects;
CREATE POLICY "anon_insert_attendance_excuses" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'attendance-excuses');

DROP POLICY IF EXISTS "anon_delete_attendance_excuses" ON storage.objects;
CREATE POLICY "anon_delete_attendance_excuses" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'attendance-excuses');
