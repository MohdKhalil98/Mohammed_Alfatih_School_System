/*
  # الانضباط الطلابي - المرحلة 2: المخطط

  إضافي بالكامل: أعمدة اختيارية جديدة على classes/students فقط،
  وجداول جديدة. لا حذف ولا تعديل لبيانات الحضور.
  المرجع: لائحة الانضباط الطلابي، القرار (279) لسنة 2025.
  الحذف النهائي ممنوع (لا سياسات DELETE) على جداول الانضباط.
*/

-- ============ أعمدة اختيارية على الجداول الحالية ============
ALTER TABLE classes  ADD COLUMN IF NOT EXISTS stage text;        -- ابتدائي / إعدادي / ثانوي
ALTER TABLE classes  ADD COLUMN IF NOT EXISTS grade_level text;  -- مثال: الأول الإعدادي
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_number text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_name text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_phone text;
CREATE UNIQUE INDEX IF NOT EXISTS students_school_number_uq
  ON students (school_number) WHERE school_number IS NOT NULL AND school_number <> '';

-- ============ إعدادات المدرسة (صف واحد) ============
CREATE TABLE IF NOT EXISTS school_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  country text NOT NULL DEFAULT 'مملكة البحرين',
  authority text NOT NULL DEFAULT 'وزارة التربية والتعليم',
  school_name text NOT NULL DEFAULT 'مدرسة أحمد الفاتح الإعدادية للبنين',
  school_logo_url text,
  ministry_logo_url text,
  academic_year text,
  term text,
  principal_name text,
  officer_name text,
  print_header_note text,
  weekend_days int[] NOT NULL DEFAULT '{5,6}',  -- 0=الأحد ... 5=الجمعة 6=السبت
  committee_recommendation_days int NOT NULL DEFAULT 2,
  guardian_notice_days int NOT NULL DEFAULT 3,
  appeal_days int NOT NULL DEFAULT 7,
  periods_verified boolean NOT NULL DEFAULT false, -- لم تُطابق المدد مع نص اللائحة بعد
  updated_at timestamptz DEFAULT now()
);
INSERT INTO school_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  label text
);

-- ============ فئات المخالفات ============
CREATE TABLE IF NOT EXISTS violation_categories (
  id int PRIMARY KEY CHECK (id BETWEEN 1 AND 4),
  name text NOT NULL,
  article text NOT NULL,
  symbol text NOT NULL,
  color text NOT NULL,
  remedies_summary jsonb NOT NULL DEFAULT '[]',
  remedies_status text NOT NULL DEFAULT 'pending_review'
);
INSERT INTO violation_categories (id, name, article, symbol, color, remedies_summary) VALUES
 (1,'الفئة الأولى (بسيطة)','المادة 5','①','#2f7d6d',
  '["إرشاد من المختصين","تنبيه شفوي سري","إنذار كتابي","استدعاء ولي الأمر وتعهد كتابي","تكليف بمهام إضافية","استبعاد مؤقت من بعض الأنشطة (حتى فصل دراسي)","النقل إلى منازل"]'),
 (2,'الفئة الثانية (جسيمة)','المادة 6','②','#b7791f',
  '["تنبيه شفوي سري","إنذار كتابي","استدعاء ولي الأمر وتعهد من الطالب وولي الأمر","تكليف بمهام إضافية","اعتذار للمتضرر","استبعاد مؤقت من بعض الأنشطة","مصادرة الجهاز حتى نهاية الفصل","إيقاف عن الدراسة من 1 إلى 10 أيام","النقل إلى منازل"]'),
 (3,'الفئة الثالثة (جسيمة جدًا)','المادة 7','③','#c05621',
  '["إنذار كتابي","استدعاء ولي الأمر وتعهد كتابي","تكليف بمهام إضافية","نقل من الفصل","حرمان من النقل المدرسي حتى سنة","إلغاء درجة الواجب/الاختبار","إيقاف من 10 أيام حتى فصل دراسي","رصد صفر في نتائج الفصل","النقل إلى منازل"]'),
 (4,'الفئة الرابعة (الأشد جسامة)','المادة 8','④','#9b2c2c',
  '["إيقاف من 10 أيام حتى سنة دراسية","رصد صفر في نتائج الفصل","النقل إلى منازل"]')
ON CONFLICT (id) DO NOTHING;

-- ============ قاعدة المخالفات (مُصدَّرة بإصدارات) ============
CREATE TABLE IF NOT EXISTS violations_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,                       -- F1-001
  version int NOT NULL DEFAULT 1,
  category_id int NOT NULL REFERENCES violation_categories(id),
  article text,
  clause text,
  official_name text NOT NULL,
  description text,
  reference_text text,
  allowed_remedies jsonb NOT NULL DEFAULT '[]',
  remedy_conditions text,
  applicable_stages text[] NOT NULL DEFAULT '{}',  -- فارغ = كل المراحل
  applicable_grades text[] NOT NULL DEFAULT '{}',
  approval_requirements text,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','verified','superseded')),
  last_reviewed date,
  source text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (code, version)
);

-- ============ الوقائع ============
CREATE SEQUENCE IF NOT EXISTS incident_ref_seq;
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no text NOT NULL UNIQUE
    DEFAULT ('DS-' || to_char(now(),'YYYY') || '-' || lpad(nextval('incident_ref_seq')::text, 6, '0')),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  violation_id uuid NOT NULL REFERENCES violations_catalog(id),
  incident_date date NOT NULL,
  incident_time time NOT NULL,
  location text NOT NULL,
  description text NOT NULL,
  observer_name text NOT NULL,
  witnesses text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','verifying','in_progress','referred','pending_approval','decided','followup_complete','closed')),
  source_attendance_date date,         -- ربط اختياري بالحضور (بعد المراجعة اليدوية)
  source_attendance_status text,
  professional_notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- منع تكرار الواقعة نفسها (الطالب + المخالفة + التاريخ + الوقت)
CREATE UNIQUE INDEX IF NOT EXISTS incidents_no_dup
  ON incidents (student_id, violation_id, incident_date, incident_time);
CREATE INDEX IF NOT EXISTS incidents_student_idx ON incidents (student_id, incident_date DESC);

-- ============ الإجراءات والتعهدات ============
CREATE TABLE IF NOT EXISTS incident_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE RESTRICT,
  action_type text NOT NULL CHECK (action_type IN (
    'guidance','verbal_warning','written_warning','guardian_summons','pledge',
    'extra_tasks','apology','committee_referral','investigation',
    'recommendation','decision','followup_closure')),
  action_no int NOT NULL,                 -- رقم الإجراء داخل الواقعة
  pledge_no int,                          -- ترقيم تنظيمي للتعهد (1،2،3...) توثيقي فقط
  action_date date NOT NULL,
  responsible_staff text NOT NULL,
  reason text NOT NULL,
  relation_note text,
  document_text text,
  approval_status text NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft','pending','approved','rejected')),
  guardian_notified_on date,
  executed_on date,
  followup_result text,
  followup_due date,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (incident_id, action_no)
);

-- ============ استدعاءات أولياء الأمور ============
CREATE SEQUENCE IF NOT EXISTS summons_no_seq;
CREATE TABLE IF NOT EXISTS guardian_summons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summons_no text NOT NULL UNIQUE DEFAULT ('SM-' || to_char(now(),'YYYY') || '-' || lpad(nextval('summons_no_seq')::text, 5, '0')),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  incident_id uuid REFERENCES incidents(id) ON DELETE RESTRICT,
  guardian_name text,
  contact text,
  reason text NOT NULL,
  created_on date NOT NULL DEFAULT current_date,
  proposed_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','ready_to_print','guardian_notified','awaiting','attended','absent','rescheduled','completed')),
  whatsapp_sent_on date,
  attended_on date,
  meeting_summary text,
  resulting_action_id uuid REFERENCES incident_actions(id) ON DELETE SET NULL,
  documented_by text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============ لجنة الانضباط والإحالات ============
CREATE SEQUENCE IF NOT EXISTS referral_no_seq;
CREATE TABLE IF NOT EXISTS committee_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_no text NOT NULL UNIQUE DEFAULT ('RF-' || to_char(now(),'YYYY') || '-' || lpad(nextval('referral_no_seq')::text, 5, '0')),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  referred_on date NOT NULL,
  reason text NOT NULL,
  investigation_minutes text,
  student_statement text,
  witness_statements text,
  evidence_notes text,
  recommendation text,
  recommendation_date date,
  reviewer_name text,
  approving_authority text,
  final_decision text,
  decision_date date,
  guardian_notified_on date,
  appeal_status text NOT NULL DEFAULT 'none' CHECK (appeal_status IN ('none','submitted','accepted','rejected')),
  appeal_date date,
  followup_notes text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','recommendation_submitted','decision_issued','followup','closed')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============ المستندات المولدة ============
CREATE SEQUENCE IF NOT EXISTS document_no_seq;
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_no text NOT NULL UNIQUE DEFAULT ('DOC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('document_no_seq')::text, 6, '0')),
  doc_type text NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE RESTRICT,
  incident_id uuid REFERENCES incidents(id) ON DELETE RESTRICT,
  action_id uuid REFERENCES incident_actions(id) ON DELETE RESTRICT,
  referral_id uuid REFERENCES committee_referrals(id) ON DELETE RESTRICT,
  summons_id uuid REFERENCES guardian_summons(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  content jsonb NOT NULL DEFAULT '{}',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz
);

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES incidents(id) ON DELETE RESTRICT,
  referral_id uuid REFERENCES committee_referrals(id) ON DELETE RESTRICT,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  CHECK (incident_id IS NOT NULL OR referral_id IS NOT NULL)
);

-- ============ سجل التدقيق (إضافة فقط) ============
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid(),
  user_name text,
  actor_role text,
  operation text NOT NULL,      -- INSERT / UPDATE / PRINT / EXPORT / APPROVE ...
  table_name text,
  row_id text,
  old_data jsonb,
  new_data jsonb,
  details text
);

-- ============ المشغلات ============
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text; rid text;
BEGIN
  SELECT full_name INTO nm FROM profiles WHERE user_id = auth.uid();
  rid := COALESCE((to_jsonb(NEW)->>'id'), (to_jsonb(OLD)->>'id'));
  INSERT INTO audit_log (user_name, actor_role, operation, table_name, row_id, old_data, new_data)
  VALUES (nm, app_role(), TG_OP, TG_TABLE_NAME, rid,
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
          CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END $$;

-- الاعتماد وتعديل المعتمد: لمدير المدرسة/مدير النظام فقط
CREATE OR REPLACE FUNCTION guard_approvals() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := app_role(); privileged boolean := COALESCE(r IN ('admin','principal'), false);
BEGIN
  IF TG_TABLE_NAME = 'incident_actions' THEN
    IF NEW.approval_status = 'approved' AND NOT privileged THEN
      RAISE EXCEPTION 'اعتماد الإجراء متاح لمدير المدرسة أو مدير النظام فقط';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.approval_status = 'approved' AND NOT privileged THEN
      RAISE EXCEPTION 'لا يمكن تعديل إجراء معتمد دون صلاحية';
    END IF;
  ELSIF TG_TABLE_NAME = 'documents' THEN
    IF NEW.status = 'approved' AND NOT privileged THEN
      RAISE EXCEPTION 'اعتماد المستند متاح لمدير المدرسة أو مدير النظام فقط';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND (NEW.content IS DISTINCT FROM OLD.content OR NEW.status <> 'approved') AND NOT privileged THEN
      RAISE EXCEPTION 'لا يمكن تعديل مستند معتمد دون صلاحية';
    END IF;
  ELSIF TG_TABLE_NAME = 'committee_referrals' THEN
    IF (NEW.final_decision IS NOT NULL OR NEW.status IN ('decision_issued','closed')) AND NOT privileged
       AND (TG_OP = 'INSERT' OR NEW.final_decision IS DISTINCT FROM OLD.final_decision OR NEW.status IS DISTINCT FROM OLD.status) THEN
      RAISE EXCEPTION 'اعتماد القرار النهائي متاح لمدير المدرسة أو مدير النظام فقط';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.final_decision IS NOT NULL AND NOT privileged THEN
      RAISE EXCEPTION 'لا يمكن تعديل قرار معتمد دون صلاحية';
    END IF;
  ELSIF TG_TABLE_NAME = 'incidents' THEN
    IF NEW.status IN ('decided','closed') AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) AND NOT privileged THEN
      RAISE EXCEPTION 'تغيير الحالة إلى «صدر قرار» أو «مغلقة» متاح لمدير المدرسة أو مدير النظام فقط';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['incidents','incident_actions','guardian_summons','committee_referrals','documents','violations_catalog','school_settings','profiles','attachments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['incident_actions','documents','committee_referrals','incidents'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guard ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION guard_approvals()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['incidents','incident_actions','guardian_summons','committee_referrals','school_settings'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', t);
  END LOOP;
END $$;

-- ============ RLS ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_settings','holidays','violation_categories','violations_catalog','incidents',
    'incident_actions','guardian_summons','committee_referrals','documents','attachments','audit_log'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- القراءة: أي مستخدم مفعّل له ملف
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (app_role() IS NOT NULL)', t || '_read', t);
  END LOOP;
END $$;

-- audit_log: القراءة للإدارة فقط، والإدراج لأي مستخدم مفعّل (طباعة/تصدير)، لا تعديل ولا حذف
DROP POLICY IF EXISTS audit_log_read ON audit_log;
CREATE POLICY audit_log_read ON audit_log FOR SELECT TO authenticated USING (has_role('admin','principal'));
DROP POLICY IF EXISTS audit_log_insert ON audit_log;
CREATE POLICY audit_log_insert ON audit_log FOR INSERT TO authenticated
  WITH CHECK (app_role() IS NOT NULL AND operation IN ('PRINT','EXPORT','LOGIN','BACKUP'));

-- إعدادات وعطل وتصنيفات: مدير النظام/المدرسة
DROP POLICY IF EXISTS school_settings_write ON school_settings;
CREATE POLICY school_settings_write ON school_settings FOR UPDATE TO authenticated
  USING (has_role('admin','principal')) WITH CHECK (has_role('admin','principal'));
DROP POLICY IF EXISTS holidays_write ON holidays;
CREATE POLICY holidays_write ON holidays FOR ALL TO authenticated
  USING (has_role('admin','principal')) WITH CHECK (has_role('admin','principal'));
DROP POLICY IF EXISTS categories_write ON violation_categories;
CREATE POLICY categories_write ON violation_categories FOR UPDATE TO authenticated
  USING (has_role('admin','principal')) WITH CHECK (has_role('admin','principal'));
DROP POLICY IF EXISTS catalog_ins ON violations_catalog;
CREATE POLICY catalog_ins ON violations_catalog FOR INSERT TO authenticated WITH CHECK (has_role('admin','principal'));
DROP POLICY IF EXISTS catalog_upd ON violations_catalog;
CREATE POLICY catalog_upd ON violations_catalog FOR UPDATE TO authenticated
  USING (has_role('admin','principal')) WITH CHECK (has_role('admin','principal'));

-- الكتابة على الوقائع والإجراءات: الموظف المختص والمدير واللجنة (بلا DELETE)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['incidents','incident_actions','guardian_summons','documents','attachments'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_ins', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (has_role(''admin'',''principal'',''recorder'',''committee''))', t || '_ins', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_upd', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (has_role(''admin'',''principal'',''recorder'',''committee'')) WITH CHECK (has_role(''admin'',''principal'',''recorder'',''committee''))', t || '_upd', t);
  END LOOP;
END $$;
-- الإحالات واللجنة: المدير وعضو اللجنة
DROP POLICY IF EXISTS committee_referrals_ins ON committee_referrals;
CREATE POLICY committee_referrals_ins ON committee_referrals FOR INSERT TO authenticated
  WITH CHECK (has_role('admin','principal','committee'));
DROP POLICY IF EXISTS committee_referrals_upd ON committee_referrals;
CREATE POLICY committee_referrals_upd ON committee_referrals FOR UPDATE TO authenticated
  USING (has_role('admin','principal','committee')) WITH CHECK (has_role('admin','principal','committee'));

-- ============ مخزن الأدلة (خاص) ============
INSERT INTO storage.buckets (id, name, public) VALUES ('discipline-evidence','discipline-evidence', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS evidence_read ON storage.objects;
CREATE POLICY evidence_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'discipline-evidence' AND has_role('admin','principal','committee','recorder'));
DROP POLICY IF EXISTS evidence_insert ON storage.objects;
CREATE POLICY evidence_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'discipline-evidence' AND has_role('admin','principal','committee','recorder'));

-- عدد وقائع الانضباط (يُستدعى من صفحة الاسترجاع حتى بدون تسجيل دخول لحماية السجلات)
CREATE OR REPLACE FUNCTION discipline_record_count() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM incidents) + (SELECT count(*) FROM guardian_summons)
$$;
GRANT EXECUTE ON FUNCTION discipline_record_count() TO anon, authenticated;
