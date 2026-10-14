/*
  # الانضباط الطلابي - المرحلة 4: الفئة الأولى بنص المادة 5 (القرار 279/2025)

  - النص أدخله المستخدم من اللائحة؛ صُححت عيوب الاستخراج الحرفية (مثل «االلتزام» → «الالتزام»).
  - تبقى الحالة pending_review حتى يطابقها المسؤول مع الأصل ويعتمدها من «قاعدة المخالفات».
  - الإصدارات القديمة المزروعة من الملخص تُحفظ بحالة superseded ولا تُحذف.
  - أُضيف نوعا إجراء: تعليق عن الأنشطة، النقل إلى منازل.
*/

ALTER TABLE incident_actions DROP CONSTRAINT IF EXISTS incident_actions_action_type_check;
ALTER TABLE incident_actions ADD CONSTRAINT incident_actions_action_type_check CHECK (action_type IN (
  'guidance','verbal_warning','written_warning','guardian_summons','pledge',
  'extra_tasks','apology','committee_referral','investigation',
  'recommendation','decision','followup_closure','activity_suspension','manazil_transfer'));

UPDATE violations_catalog SET status = 'superseded'
 WHERE category_id = 1 AND version = 1 AND status = 'pending_review' AND source LIKE 'ملخص صفحة الوزارة%';

UPDATE violation_categories SET remedies_status = 'pending_review', remedies_summary = '[
  "توجيه وإرشاد الطالب من قبل المختصين في المدرسة",
  "التنبيه الشفوي الانفرادي",
  "الإنذار الكتابي",
  "استدعاء ولي الأمر وإخطاره بسلوك الطالب وأخذ تعهد كتابي على الطالب، وولي الأمر في حالة تكرار المخالفة",
  "تكليف الطالب بمهام إضافية",
  "التعليق المؤقت عن المشاركة في بعض الأنشطة الطلابية أو الفعاليات أو الرحلات المدرسية لمدة لا تتجاوز فصلًا دراسيًا واحدًا (بقرار من لجنة الانضباط الطلابي)",
  "فصل الطالب من التعليم النظامي الصباحي ونقله إلى نظام التعليم «منازل» لمن تجاوز مرحلة الإلزام"
]'::jsonb WHERE id = 1;

INSERT INTO violations_catalog (code, version, category_id, article, clause, official_name, reference_text, allowed_remedies, remedy_conditions, approval_requirements, status, last_reviewed, source)
SELECT v.code, 2, 1, 'المادة 5', v.clause, v.name, 'المادة 5 أولًا (' || v.clause || '): ' || v.name,
       '["guidance","verbal_warning","written_warning","guardian_summons","pledge","extra_tasks","activity_suspension","manazil_transfer"]'::jsonb, 'المعالجات من المادة 5 ثانيًا: (4) استدعاء ولي الأمر وإخطاره بسلوك الطالب وأخذ تعهد كتابي على الطالب، وولي الأمر في حالة تكرار المخالفة؛ (6) التعليق المؤقت عن المشاركة في بعض الأنشطة الطلابية أو الفعاليات أو الرحلات المدرسية لمدة لا تتجاوز فصلًا دراسيًا واحدًا يصدر بتحديدها قرار من لجنة الانضباط الطلابي؛ (7) فصل الطالب من التعليم النظامي الصباحي ونقله إلى نظام التعليم «منازل» لمن تجاوز مرحلة الإلزام.',
       'التعليق عن الأنشطة بقرار من لجنة الانضباط الطلابي', 'pending_review', current_date,
       'نص اللائحة (القرار 279/2025) المادة 5 — أدخله المستخدم؛ يُطابَق مع الأصل قبل الاعتماد'
FROM (VALUES
  ('F1-001','1','تكرار التأخر عن الدوام الدراسي.'),
  ('F1-002','2','تكرار التأخر عن الطابور الصباحي.'),
  ('F1-003','3','تكرار عدم المشاركة في الطابور الصباحي.'),
  ('F1-004','4','تكرار التأخر عن حضور بدء الحصة الدراسية.'),
  ('F1-005','5','الدخول أو الخروج من الصف خلال الحصة دون استئذان.'),
  ('F1-006','6','الغياب عن الحصص الدراسية دون وجود عذر مقبول.'),
  ('F1-007','7','الغياب عن المدرسة، أو عدم دخول الصفوف الافتراضية حسب الجدول الدراسي دون عذر مقبول.'),
  ('F1-008','8','تكرار التأخر في أداء التطبيقات والأنشطة التعليمية المطلوب إنجازها.'),
  ('F1-009','9','عدم أداء التطبيقات والأنشطة التعليمية المطلوب إنجازها.'),
  ('F1-010','10','عدم إحضار الكتب والأدوات المدرسية المطلوبة.'),
  ('F1-011','11','عدم الالتزام بالزي المدرسي أو الرياضي.'),
  ('F1-012','12','عدم الالتزام بالمظهر العام اللائق مثل (ارتداء القبعات، الإكسسوارات غير اللائقة، استخدام مستحضرات التجميل وأصباغ الأظافر، تسريح الشعر أو قصه بطريقة غير لائقة).'),
  ('F1-013','13','عدم المحافظة على نظافة المدرسة.')
) AS v(code, clause, name)
WHERE NOT EXISTS (SELECT 1 FROM violations_catalog x WHERE x.code = v.code AND x.version = 2);
