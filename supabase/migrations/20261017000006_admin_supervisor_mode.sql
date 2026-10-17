/*
  # وضع المشرف لمدير النظام

  مدير النظام الذي عُيِّنت له صفوف (supervisor_classes) يستطيع التبديل إلى «وضع المشرف» من الشريط الجانبي:
  تُرسل الواجهة الترويسة x-view-as: supervisor، فتقيّد قاعدة البيانات الصفوف والطلاب والحضور والوقائع
  وما يتبعها بصفوفه المعيَّنة فقط، كما يرى المشرف تمامًا. وبدون الترويسة يرى كل شيء.
  الترويسة لا تمنح أي صلاحية: لا تؤثر إلا على مدير النظام، وتقلّل ما يراه فقط.
*/

CREATE OR REPLACE FUNCTION active_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN app_role() = 'admin'
     AND coalesce((nullif(current_setting('request.headers', true), '')::json) ->> 'x-view-as', '') = 'supervisor'
    THEN 'supervisor'
    ELSE app_role()
  END
$$;

CREATE OR REPLACE FUNCTION can_access_class(cid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(active_role() = 'admin', false) OR (
    cid IS NOT NULL
    AND COALESCE(active_role() = 'supervisor', false)
    AND EXISTS (
      SELECT 1 FROM supervisor_classes sc
      JOIN profiles p ON p.user_id = sc.user_id
      WHERE sc.user_id = auth.uid() AND sc.class_id = cid AND p.active
    )
  )
$$;
