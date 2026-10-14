/*
# إنشاء جداول نظام الحضور والغياب الطلابي

## الوصف
إنشاء قاعدة بيانات كاملة لنظام إدارة الحضور والغياب الطلابي لمدرسة أحمد الفاتح الإعدادية للبنين.
النظام يعمل بدون تسجيل دخول (لا يوجد مصادقة) — جميع البيانات مشتركة ويمكن الوصول إليها عبر مفتاح anon.

## الجداول الجديدة

### 1. جدول الصفوف (classes)
- `id` (uuid, المفتاح الأساسي)
- `name` (text, اسم الصف - ليس فارغًا)
- `order_index` (int, ترتيب الصف في القائمة)
- `created_at` (timestamptz, تاريخ الإنشاء)

### 2. جدول الطلاب (students)
- `id` (uuid, المفتاح الأساسي)
- `name` (text, اسم الطالب - ليس فارغًا)
- `class_id` (uuid, مفتاح أجنبي يربط بالصف)
- `created_at` (timestamptz, تاريخ الإنشاء)

### 3. جدول الحضور والغياب (attendance)
- `id` (uuid, المفتاح الأساسي)
- `student_id` (uuid, مفتاح أجنبي يربط بالطالب)
- `class_id` (uuid, مفتاح أجنبي يربط بالصف)
- `date` (date, التاريخ - ليس فارغًا)
- `status` (text, الحالة: حاضر / غائب بعذر / غائب بلا عذر)
- `note` (text, ملاحظات)
- `created_at` (timestamptz, تاريخ الإنشاء)
- قيد فريد على (student_id, date) لمنع تكرار سجل لنفس الطالب في نفس اليوم

## الأمان
- تفعيل RLS على جميع الجداول
- السماح لـ anon و authenticated بجميع عمليات CRUD لأن التطبيق لا يتطلب تسجيل دخول

## ملاحظات
- إدراج ثلاثة صفوف مبدئية: أول إعدادي 7، أول إعدادي 8، أول إعدادي 9
*/

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_classes" ON classes;
CREATE POLICY "anon_select_classes" ON classes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_classes" ON classes;
CREATE POLICY "anon_insert_classes" ON classes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_classes" ON classes;
CREATE POLICY "anon_update_classes" ON classes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_classes" ON classes;
CREATE POLICY "anon_delete_classes" ON classes FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_students" ON students;
CREATE POLICY "anon_select_students" ON students FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_students" ON students;
CREATE POLICY "anon_insert_students" ON students FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_students" ON students;
CREATE POLICY "anon_update_students" ON students FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_students" ON students;
CREATE POLICY "anon_delete_students" ON students FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'حاضر',
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_attendance" ON attendance;
CREATE POLICY "anon_select_attendance" ON attendance FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_attendance" ON attendance;
CREATE POLICY "anon_insert_attendance" ON attendance FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_attendance" ON attendance;
CREATE POLICY "anon_update_attendance" ON attendance FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_attendance" ON attendance;
CREATE POLICY "anon_delete_attendance" ON attendance FOR DELETE
  TO anon, authenticated USING (true);

-- إدراج الصفوف الابتدائية
INSERT INTO classes (name, order_index) VALUES
  ('أول إعدادي 7', 1),
  ('أول إعدادي 8', 2),
  ('أول إعدادي 9', 3)
ON CONFLICT DO NOTHING;
