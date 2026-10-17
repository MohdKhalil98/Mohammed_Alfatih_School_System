/*
  # المشرف الإداري يدير طلاب صفوفه (إضافة وتعديل وحذف)

  - طلاب الصفوف المعيَّنة للمشرف فقط؛ مدير النظام على كل الصفوف.
  - لا يستطيع المشرف نقل طالب إلى صف ليس من صفوفه.
*/

DROP POLICY IF EXISTS students_insert ON students;
CREATE POLICY students_insert ON students FOR INSERT TO authenticated
  WITH CHECK (can_access_class(class_id));

DROP POLICY IF EXISTS students_update ON students;
CREATE POLICY students_update ON students FOR UPDATE TO authenticated
  USING (can_access_class(class_id)) WITH CHECK (can_access_class(class_id));

DROP POLICY IF EXISTS students_delete ON students;
CREATE POLICY students_delete ON students FOR DELETE TO authenticated
  USING (can_access_class(class_id));
