/*
  # الأدوار: مدير النظام + المشرف الإداري (مقيَّد بصفوفه)

  - admin: جميع الصلاحيات.
  - supervisor: يتابع ويسجّل (حضور، وقائع، إجراءات، استدعاءات، إحالات، مستندات) لصفوفه فقط.
  - تحويل الحسابات: principal -> admin، وباقي الأدوار -> supervisor (بلا صفوف حتى يعيّنها المدير).
  - إغلاق الوصول المفتوح (anon) على جداول الحضور واستبداله بسياسات تعتمد الدخول والصفوف.
*/

-- ============ الأدوار ============
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE profiles SET role = 'admin' WHERE role = 'principal';
UPDATE profiles SET role = 'supervisor' WHERE role NOT IN ('admin', 'supervisor');
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'supervisor'));
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'supervisor';

-- ============ صفوف المشرف ============
CREATE TABLE IF NOT EXISTS supervisor_classes (
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, class_id)
);
ALTER TABLE supervisor_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supervisor_classes_select ON supervisor_classes;
CREATE POLICY supervisor_classes_select ON supervisor_classes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role('admin'));
DROP POLICY IF EXISTS supervisor_classes_insert ON supervisor_classes;
CREATE POLICY supervisor_classes_insert ON supervisor_classes FOR INSERT TO authenticated
  WITH CHECK (has_role('admin'));
DROP POLICY IF EXISTS supervisor_classes_delete ON supervisor_classes;
CREATE POLICY supervisor_classes_delete ON supervisor_classes FOR DELETE TO authenticated
  USING (has_role('admin'));

-- ============ دوال الوصول (SECURITY DEFINER لتفادي التكرار بين سياسات RLS) ============
CREATE OR REPLACE FUNCTION can_access_class(cid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(has_role('admin'), false) OR (
    cid IS NOT NULL AND EXISTS (
      SELECT 1 FROM supervisor_classes sc
      JOIN profiles p ON p.user_id = sc.user_id
      WHERE sc.user_id = auth.uid() AND sc.class_id = cid AND p.active AND p.role = 'supervisor'
    )
  )
$$;

CREATE OR REPLACE FUNCTION can_access_student(sid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM students s WHERE s.id = sid AND can_access_class(s.class_id))
$$;

CREATE OR REPLACE FUNCTION can_access_incident(iid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM incidents i
    WHERE i.id = iid AND (can_access_class(i.class_id) OR (i.class_id IS NULL AND can_access_student(i.student_id)))
  )
$$;

CREATE OR REPLACE FUNCTION can_access_referral(rid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM committee_referrals r WHERE r.id = rid AND can_access_incident(r.incident_id))
$$;

CREATE OR REPLACE FUNCTION can_access_evidence(path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN split_part(path, '/', 1) ~ '^[0-9a-fA-F-]{36}$' THEN can_access_incident(split_part(path, '/', 1)::uuid)
    ELSE false
  END
$$;

-- ============ الصفوف والطلاب والحضور (إغلاق anon) ============
DO $$
DECLARE t text; op text;
BEGIN
  FOREACH t IN ARRAY ARRAY['classes', 'students', 'attendance'] LOOP
    FOREACH op IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'anon_' || op || '_' || t, t);
    END LOOP;
  END LOOP;
END $$;

DROP POLICY IF EXISTS classes_select ON classes;
CREATE POLICY classes_select ON classes FOR SELECT TO authenticated USING (can_access_class(id));
DROP POLICY IF EXISTS classes_insert ON classes;
CREATE POLICY classes_insert ON classes FOR INSERT TO authenticated WITH CHECK (has_role('admin'));
DROP POLICY IF EXISTS classes_update ON classes;
CREATE POLICY classes_update ON classes FOR UPDATE TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));
DROP POLICY IF EXISTS classes_delete ON classes;
CREATE POLICY classes_delete ON classes FOR DELETE TO authenticated USING (has_role('admin'));

DROP POLICY IF EXISTS students_select ON students;
CREATE POLICY students_select ON students FOR SELECT TO authenticated USING (can_access_class(class_id));
DROP POLICY IF EXISTS students_insert ON students;
CREATE POLICY students_insert ON students FOR INSERT TO authenticated WITH CHECK (has_role('admin'));
DROP POLICY IF EXISTS students_update ON students;
CREATE POLICY students_update ON students FOR UPDATE TO authenticated USING (has_role('admin')) WITH CHECK (has_role('admin'));
DROP POLICY IF EXISTS students_delete ON students;
CREATE POLICY students_delete ON students FOR DELETE TO authenticated USING (has_role('admin'));

DROP POLICY IF EXISTS attendance_select ON attendance;
CREATE POLICY attendance_select ON attendance FOR SELECT TO authenticated USING (can_access_class(class_id));
DROP POLICY IF EXISTS attendance_insert ON attendance;
CREATE POLICY attendance_insert ON attendance FOR INSERT TO authenticated WITH CHECK (can_access_class(class_id));
DROP POLICY IF EXISTS attendance_update ON attendance;
CREATE POLICY attendance_update ON attendance FOR UPDATE TO authenticated
  USING (can_access_class(class_id)) WITH CHECK (can_access_class(class_id));
DROP POLICY IF EXISTS attendance_delete ON attendance;
CREATE POLICY attendance_delete ON attendance FOR DELETE TO authenticated USING (can_access_class(class_id));

-- ============ جداول الانضباط: التقييد بالصفوف ============
-- (الجداول العامة: الإعدادات والعطل والفئات وقاعدة المخالفات تبقى للقراءة لكل مستخدم مفعّل وللكتابة للمدير)
DO $$
DECLARE t text; cond text;
BEGIN
  FOR t, cond IN SELECT * FROM (VALUES
    ('incidents', 'can_access_class(class_id) OR (class_id IS NULL AND can_access_student(student_id))'),
    ('incident_actions', 'can_access_incident(incident_id)'),
    ('guardian_summons', 'can_access_student(student_id)'),
    ('committee_referrals', 'can_access_incident(incident_id)'),
    ('documents', '(incident_id IS NULL AND student_id IS NULL AND app_role() IS NOT NULL) OR can_access_incident(incident_id) OR can_access_student(student_id)'),
    ('attachments', '(incident_id IS NOT NULL AND can_access_incident(incident_id)) OR (referral_id IS NOT NULL AND can_access_referral(referral_id))')
  ) AS v(tbl, expr) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (app_role() IS NOT NULL AND (%s))', t || '_read', t, cond);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_ins', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (app_role() IS NOT NULL AND (%s))', t || '_ins', t, cond);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_upd', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (app_role() IS NOT NULL AND (%s)) WITH CHECK (app_role() IS NOT NULL AND (%s))', t || '_upd', t, cond, cond);
  END LOOP;
END $$;

-- ============ التخزين ============
DROP POLICY IF EXISTS evidence_read ON storage.objects;
CREATE POLICY evidence_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'discipline-evidence' AND can_access_evidence(name));
DROP POLICY IF EXISTS evidence_insert ON storage.objects;
CREATE POLICY evidence_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'discipline-evidence' AND can_access_evidence(name));

-- مرفقات العذر: كانت مفتوحة (anon)، أصبحت لأي مستخدم مفعّل
DROP POLICY IF EXISTS "anon_select_attendance_excuses" ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_attendance_excuses" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_attendance_excuses" ON storage.objects;
DROP POLICY IF EXISTS attendance_excuses_select ON storage.objects;
CREATE POLICY attendance_excuses_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attendance-excuses' AND app_role() IS NOT NULL);
DROP POLICY IF EXISTS attendance_excuses_insert ON storage.objects;
CREATE POLICY attendance_excuses_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attendance-excuses' AND app_role() IS NOT NULL);
DROP POLICY IF EXISTS attendance_excuses_delete ON storage.objects;
CREATE POLICY attendance_excuses_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attendance-excuses' AND has_role('admin'));
