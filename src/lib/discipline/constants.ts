import type {
  ActionType, ApprovalStatus, IncidentStatus, Role, SummonsStatus,
} from './types';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'مدير النظام',
  principal: 'مدير المدرسة / من يفوّضه',
  recorder: 'موظف تسجيل الوقائع',
  committee: 'عضو لجنة الانضباط',
  viewer: 'قراءة وتقارير',
};

// صلاحيات الواجهة (الفرض الحقيقي في سياسات RLS والمشغلات بقاعدة البيانات)
export const can = {
  write: (r?: Role) => !!r && ['admin', 'principal', 'recorder', 'committee'].includes(r),
  approve: (r?: Role) => !!r && ['admin', 'principal'].includes(r),
  committee: (r?: Role) => !!r && ['admin', 'principal', 'committee'].includes(r),
  settings: (r?: Role) => !!r && ['admin', 'principal'].includes(r),
  admin: (r?: Role) => r === 'admin',
  audit: (r?: Role) => !!r && ['admin', 'principal'].includes(r),
  evidence: (r?: Role) => !!r && ['admin', 'principal', 'recorder', 'committee'].includes(r),
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  new: 'مسجلة حديثًا',
  verifying: 'قيد التحقق',
  in_progress: 'قيد الإجراء',
  referred: 'محالة إلى اللجنة',
  pending_approval: 'بانتظار الاعتماد',
  decided: 'صدر بشأنها قرار',
  followup_complete: 'مكتملة المتابعة',
  closed: 'مغلقة إداريًا',
};
export const INCIDENT_STATUS_ORDER = Object.keys(INCIDENT_STATUS_LABELS) as IncidentStatus[];
// الحالات التي تتطلب مدير المدرسة/النظام (تطابق مشغل guard_approvals)
export const APPROVER_ONLY_INCIDENT_STATUS: IncidentStatus[] = ['decided', 'closed'];

export const ACTION_LABELS: Record<ActionType, string> = {
  guidance: 'النصح والإرشاد',
  verbal_warning: 'تنبيه شفوي',
  written_warning: 'إنذار كتابي',
  guardian_summons: 'استدعاء ولي الأمر',
  pledge: 'تعهد كتابي',
  extra_tasks: 'تكليف بمهام إضافية',
  apology: 'اعتذار / إصلاح الضرر',
  committee_referral: 'إحالة إلى لجنة الانضباط',
  investigation: 'تحقيق وتوثيق أقوال',
  recommendation: 'توصية للجهة المختصة',
  decision: 'قرار معتمد',
  followup_closure: 'متابعة وإغلاق',
  activity_suspension: 'تعليق مؤقت عن بعض الأنشطة',
  manazil_transfer: 'النقل إلى نظام «منازل»',
  device_confiscation: 'التحفظ على الجهاز الإلكتروني',
  class_suspension: 'تعليق دخول الصف الدراسي',
  class_transfer: 'نقل الطالب إلى صف آخر',
  bus_suspension: 'تعليق استعمال المواصلات المدرسية',
  grade_cancellation: 'إلغاء درجة التطبيق أو الامتحان',
  zero_results: 'شطب نتائج الفصل ورصد درجة صفر',
};

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  draft: 'مسودة',
  pending: 'بانتظار الاعتماد',
  approved: 'معتمد',
  rejected: 'مرفوض',
};

export const PLEDGE_LABELS: Record<number, string> = {
  1: 'التعهد الأول',
  2: 'التعهد الثاني',
  3: 'التعهد الثالث',
};
export function pledgeLabel(n: number | null | undefined): string {
  if (!n) return '';
  return PLEDGE_LABELS[n] ?? `التعهد رقم ${n}`;
}

export const SUMMONS_LABELS: Record<SummonsStatus, string> = {
  draft: 'مسودة',
  ready_to_print: 'جاهز للطباعة',
  guardian_notified: 'تم إبلاغ ولي الأمر',
  awaiting: 'بانتظار الحضور',
  attended: 'حضر ولي الأمر',
  absent: 'لم يحضر',
  rescheduled: 'أُعيد تحديد الموعد',
  completed: 'مكتمل',
};

export const REFERRAL_STATUS_LABELS = {
  open: 'مفتوحة',
  recommendation_submitted: 'رُفعت التوصية',
  decision_issued: 'صدر القرار',
  followup: 'قيد المتابعة',
  closed: 'مغلقة',
} as const;

export const APPEAL_LABELS = {
  none: 'لا يوجد',
  submitted: 'مقدَّم',
  accepted: 'مقبول',
  rejected: 'مرفوض',
} as const;

export const STAGES = ['ابتدائي', 'إعدادي', 'ثانوي'];
export const LOCATIONS = ['الفصل', 'الطابور الصباحي', 'الساحة', 'الممر', 'المقصف', 'دورة المياه', 'الحافلة', 'المختبر', 'خارج المدرسة / نشاط', 'التعلم عن بعد', 'أخرى'];

export const STATUS_PENDING_NOTE =
  'هذه المخالفة بانتظار مراجعة واعتماد المسؤول — لم تُطابق مع النص الرسمي بعد.';

export const DOC_TYPES: { key: string; label: string; needs: ('incident' | 'action' | 'referral' | 'summons' | 'student' | 'class')[] }[] = [
  { key: 'incident_record', label: 'سجل واقعة سلوكية', needs: ['incident'] },
  { key: 'guidance', label: 'نموذج توجيه وإرشاد', needs: ['incident'] },
  { key: 'notice', label: 'نموذج تنبيه', needs: ['incident'] },
  { key: 'written_warning', label: 'نموذج إنذار كتابي', needs: ['incident'] },
  { key: 'summons', label: 'استدعاء ولي أمر', needs: ['incident'] },
  { key: 'pledge_student', label: 'تعهد طالب', needs: ['incident'] },
  { key: 'pledge_guardian', label: 'تعهد ولي أمر', needs: ['incident'] },
  { key: 'pledge_both', label: 'تعهد طالب وولي أمر', needs: ['incident'] },
  { key: 'extra_tasks', label: 'نموذج تكليف بمهام إضافية', needs: ['incident'] },
  { key: 'referral_memo', label: 'مذكرة إحالة إلى لجنة الانضباط', needs: ['referral'] },
  { key: 'investigation_minutes', label: 'محضر تحقيق', needs: ['referral'] },
  { key: 'statements', label: 'محضر أقوال الطالب والشهود', needs: ['referral'] },
  { key: 'committee_recommendation', label: 'توصية لجنة الانضباط', needs: ['referral'] },
  { key: 'decision_notice', label: 'إخطار ولي الأمر بالقرار', needs: ['referral'] },
  { key: 'followup', label: 'نموذج متابعة تنفيذ الإجراء', needs: ['incident'] },
  { key: 'appeal', label: 'نموذج تظلم', needs: ['referral'] },
  { key: 'student_ledger', label: 'سجل المخالفات الفردي', needs: ['student'] },
  { key: 'class_report', label: 'تقرير مخالفات الفصل', needs: ['class'] },
];
