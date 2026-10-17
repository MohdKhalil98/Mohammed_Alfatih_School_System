/*
  # الاسم الكامل والبريد لكل حساب + صفوف المدرسة

  - إضافة عمود email في profiles (يُملأ من حسابات Supabase Auth) وجعل الاسم الكامل إلزاميًا.
  - admin_add_profile تحفظ البريد وتشترط الاسم.
  - إضافة الفصول: سادس ابتدائي 1-8، أول إعدادي 1-9، ثاني إعدادي 1-6، ثالث إعدادي 1-6
    (الموجود منها يُحدَّث ترتيبه ومرحلته دون تكرار).
*/

-- ============ الحسابات ============
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

UPDATE profiles p SET email = lower(u.email)
FROM auth.users u
WHERE u.id = p.user_id AND p.email IS NULL;

UPDATE profiles SET full_name = split_part(email, '@', 1)
WHERE btrim(full_name) = '' AND email IS NOT NULL;
UPDATE profiles SET full_name = 'بدون اسم' WHERE btrim(full_name) = '';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_full_name_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_full_name_check CHECK (btrim(full_name) <> '');

CREATE OR REPLACE FUNCTION admin_add_profile(p_email text, p_name text, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE uid uuid;
BEGIN
  IF NOT has_role('admin') THEN
    RAISE EXCEPTION 'هذه العملية لمدير النظام فقط';
  END IF;
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'الاسم الكامل مطلوب';
  END IF;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(btrim(p_email));
  IF uid IS NULL THEN
    RAISE EXCEPTION 'لا يوجد مستخدم بهذا البريد. أنشئه أولًا من لوحة Supabase (Authentication > Users)';
  END IF;
  INSERT INTO profiles (user_id, full_name, role, email)
  VALUES (uid, btrim(p_name), p_role, lower(btrim(p_email)))
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, email = EXCLUDED.email, active = true;
END $$;

-- ============ الصفوف ============
DO $$
DECLARE r record; n int; nm text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('سادس ابتدائي', 'ابتدائي', 'السادس الابتدائي', 8, 100),
    ('أول إعدادي',   'إعدادي',  'الأول الإعدادي',   9, 200),
    ('ثاني إعدادي',  'إعدادي',  'الثاني الإعدادي',  6, 300),
    ('ثالث إعدادي',  'إعدادي',  'الثالث الإعدادي',  6, 400)
  ) AS v(base, stg, grade, cnt, ord) LOOP
    FOR n IN 1..r.cnt LOOP
      nm := r.base || ' ' || n;
      IF EXISTS (SELECT 1 FROM classes WHERE name = nm) THEN
        UPDATE classes
        SET stage = COALESCE(stage, r.stg), grade_level = COALESCE(grade_level, r.grade), order_index = r.ord + n
        WHERE name = nm;
      ELSE
        INSERT INTO classes (name, stage, grade_level, order_index) VALUES (nm, r.stg, r.grade, r.ord + n);
      END IF;
    END LOOP;
  END LOOP;
END $$;
