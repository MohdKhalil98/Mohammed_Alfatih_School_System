/*
  # إلغاء فكرة اعتماد المسؤول وتبسيط حالات الواقعة

  - حالات الواقعة: new (مسجلة حديثًا) و closed (مغلقة إداريًا) فقط.
  - إزالة مشغل guard_approvals الذي كان يقصر الاعتماد على مدير المدرسة/النظام.
  - اعتبار كل المخالفات والإجراءات والمستندات القائمة معتمدة.
*/

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['incident_actions','documents','committee_referrals','incidents'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guard ON %I', t);
  END LOOP;
END $$;

UPDATE incidents SET status = 'new' WHERE status NOT IN ('new','closed');
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_status_check CHECK (status IN ('new','closed'));

UPDATE violations_catalog SET status = 'verified' WHERE status = 'pending_review';
UPDATE incident_actions SET approval_status = 'approved' WHERE approval_status <> 'approved';
UPDATE documents SET status = 'approved' WHERE status = 'draft';
