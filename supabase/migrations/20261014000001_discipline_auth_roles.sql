/*
  # الانضباط الطلابي - المرحلة 1: المستخدمون والأدوار

  - جدول profiles يربط مستخدمي Supabase Auth بدور وظيفي.
  - لا يمس جداول الحضور (classes / students / attendance) ولا سياساتها.
  - إنشاء أول مدير نظام يدوي (انظر docs/discipline-setup.md):
      insert into profiles (user_id, full_name, role)
      select id, 'اسم المدير', 'admin' from auth.users where email = 'EMAIL';
*/

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin','principal','recorder','committee','viewer')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- دور المستخدم الحالي (null إذا لم يكن له ملف أو كان معطلًا)
CREATE OR REPLACE FUNCTION app_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() AND active
$$;

CREATE OR REPLACE FUNCTION has_role(VARIADIC roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(app_role() = ANY(roles), false)
$$;

DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role('admin','principal'));

DROP POLICY IF EXISTS profiles_admin_insert ON profiles;
CREATE POLICY profiles_admin_insert ON profiles FOR INSERT TO authenticated
  WITH CHECK (has_role('admin'));

DROP POLICY IF EXISTS profiles_admin_update ON profiles;
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE TO authenticated
  USING (has_role('admin')) WITH CHECK (has_role('admin'));
-- لا سياسة حذف: تعطيل المستخدم يتم بالحقل active

-- يضيف مدير النظام ملفًا لمستخدم أُنشئ مسبقًا في Supabase Auth (بالبريد الإلكتروني)
CREATE OR REPLACE FUNCTION admin_add_profile(p_email text, p_name text, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE uid uuid;
BEGIN
  IF NOT has_role('admin') THEN
    RAISE EXCEPTION 'هذه العملية لمدير النظام فقط';
  END IF;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(p_email);
  IF uid IS NULL THEN
    RAISE EXCEPTION 'لا يوجد مستخدم بهذا البريد. أنشئه أولًا من لوحة Supabase (Authentication > Users)';
  END IF;
  INSERT INTO profiles (user_id, full_name, role) VALUES (uid, p_name, p_role)
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, active = true;
END $$;
REVOKE ALL ON FUNCTION admin_add_profile(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_add_profile(text,text,text) TO authenticated;
