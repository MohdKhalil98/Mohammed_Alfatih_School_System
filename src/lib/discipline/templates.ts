import { ACTION_LABELS, DOC_TYPES, INCIDENT_STATUS_LABELS, pledgeLabel } from './constants';
import type {
  Category, ClassX, Incident, IncidentAction, Referral, StudentX, Summons, Violation,
} from './types';

export type DocModel = {
  title: string;
  sections: {
    heading?: string;
    rows?: [string, string][];
    text?: string;
    table?: { head: string[]; rows: string[][] };
  }[];
  signatures: string[];
};

export type DocCtx = {
  student?: StudentX;
  cls?: ClassX;
  incident?: Incident;
  violation?: Violation;
  category?: Category;
  actions?: IncidentAction[];
  referral?: Referral;
  summons?: Summons;
  studentIncidents?: { incident: Incident; violation?: Violation; category?: Category; actions: IncidentAction[] }[];
  classRows?: { student: StudentX; counts: number[]; total: number }[];
  categories?: Category[];
  className?: string;
  fmt: (d: string | null | undefined) => string;
};

const dash = (v: string | null | undefined) => (v && String(v).trim() ? String(v) : '—');

function studentRows(c: DocCtx): [string, string][] {
  return [
    ['اسم الطالب', dash(c.student?.name)],
    ['الرقم المدرسي', dash(c.student?.school_number)],
    ['المرحلة / الصف', `${dash(c.cls?.stage)} / ${dash(c.cls?.grade_level)}`],
    ['الفصل', dash(c.cls?.name)],
  ];
}

function incidentRows(c: DocCtx): [string, string][] {
  const i = c.incident;
  const v = c.violation;
  return [
    ['رقم الواقعة', dash(i?.ref_no)],
    ['تاريخ الواقعة', c.fmt(i?.incident_date)],
    ['الفئة', c.category ? `${c.category.symbol} ${c.category.name}` : '—'],
    ['رقم المخالفة', dash(v?.code)],
    ['المخالفة', dash(v?.official_name)],
    ['المادة الرسمية', v ? `${dash(c.category?.article)}${v.clause ? ' — البند ' + v.clause : ' — البند غير مدخل'}` : '—'],
    ['وصف الواقعة', dash(i?.description)],
  ];
}

function lastAction(c: DocCtx, type?: string): IncidentAction | undefined {
  const list = (c.actions ?? []).filter((a) => !type || a.action_type === type);
  return list[list.length - 1];
}

const SIGN = {
  student: 'توقيع الطالب',
  guardian: 'توقيع ولي الأمر',
  staff: 'الموظف المختص',
  counselor: 'المرشد الاجتماعي',
  principal: 'مدير المدرسة',
  committee: 'رئيس لجنة الانضباط',
};

export function buildDoc(type: string, c: DocCtx): DocModel {
  const label = DOC_TYPES.find((d) => d.key === type)?.label ?? type;
  const base = (rows: [string, string][] = [], text?: string, signatures: string[] = [SIGN.staff, SIGN.principal]): DocModel => ({
    title: label,
    sections: [
      { heading: 'بيانات الطالب', rows: studentRows(c) },
      ...(c.incident ? [{ heading: 'بيانات الواقعة', rows: incidentRows(c) }] : []),
      ...(rows.length ? [{ heading: 'بيانات النموذج', rows }] : []),
      ...(text ? [{ text }] : []),
    ],
    signatures,
  });
  const act = lastAction(c);
  const actRows: [string, string][] = act
    ? [
        ['الإجراء', `${ACTION_LABELS[act.action_type]}${act.pledge_no ? ' — ' + pledgeLabel(act.pledge_no) : ''}`],
        ['تاريخ الإجراء', c.fmt(act.action_date)],
        ['سبب الإجراء', dash(act.reason)],
        ['الموظف المسؤول', dash(act.responsible_staff)],
      ]
    : [['الإجراء', '................................'], ['تاريخ الإجراء', '....../....../........']];

  switch (type) {
    case 'incident_record':
      return base([['الحالة', c.incident ? INCIDENT_STATUS_LABELS[c.incident.status] : '—'], ['المكان', dash(c.incident?.location)], ['الراصد', dash(c.incident?.observer_name)], ['الشهود', dash(c.incident?.witnesses)]],
        'تسجيل الواقعة لا يعني ثبوت المخالفة أو اعتماد عقوبة، ويخضع للتحقق وفق اللائحة.', [SIGN.staff, SIGN.counselor, SIGN.principal]);
    case 'guidance':
      return base([...actRows, ['محاور التوجيه', dash(act?.document_text)]], undefined, [SIGN.staff, SIGN.counselor, SIGN.student]);
    case 'notice':
      return base([...actRows, ['نص التنبيه', dash(act?.document_text)]], undefined, [SIGN.staff, SIGN.student, SIGN.principal]);
    case 'written_warning':
      return base([...actRows, ['نص الإنذار', dash(act?.document_text)]], undefined, [SIGN.staff, SIGN.principal, SIGN.guardian]);
    case 'summons':
      return {
        title: label,
        sections: [
          { heading: 'بيانات الطالب', rows: studentRows(c) },
          ...(c.incident ? [{ heading: 'بيانات الواقعة', rows: incidentRows(c) }] : []),
          {
            heading: 'بيانات الاستدعاء',
            rows: [
              ['رقم الاستدعاء', dash(c.summons?.summons_no)],
              ['ولي الأمر', dash(c.summons?.guardian_name)],
              ['سبب الاستدعاء', dash(c.summons?.reason)],
              ['الموعد المقترح', c.summons?.proposed_at ? new Date(c.summons.proposed_at).toLocaleString('ar-BH-u-nu-latn') : '—'],
            ],
          },
          { text: 'نأمل من ولي الأمر الكريم الحضور في الموعد المحدد، وشكرًا لتعاونكم.' },
        ],
        signatures: [SIGN.staff, SIGN.principal, SIGN.guardian],
      };
    case 'pledge_student':
      return base(actRows, 'أتعهد أنا الطالب المذكور أعلاه بالالتزام بأنظمة المدرسة ولائحة الانضباط الطلابي وعدم تكرار ما صدر مني، وأتحمل ما يترتب على مخالفة هذا التعهد وفق اللائحة.', [SIGN.student, SIGN.staff, SIGN.principal]);
    case 'pledge_guardian':
      return base(actRows, 'أتعهد أنا ولي أمر الطالب المذكور أعلاه بمتابعة سلوكه والتعاون مع المدرسة لعدم تكرار ما صدر منه، وأقر بعلمي بالواقعة وبالإجراء المتخذ.', [SIGN.guardian, SIGN.staff, SIGN.principal]);
    case 'pledge_both':
      return base(actRows, 'نتعهد نحن الطالب وولي أمره بالالتزام بأنظمة المدرسة ولائحة الانضباط الطلابي وعدم تكرار ما صدر، ونقر بعلمنا بالواقعة وبالإجراء المتخذ.', [SIGN.student, SIGN.guardian, SIGN.staff, SIGN.principal]);
    case 'extra_tasks':
      return base([...actRows, ['المهام المكلف بها', dash(act?.document_text)], ['موعد المتابعة', c.fmt(act?.followup_due)]], undefined, [SIGN.staff, SIGN.student, SIGN.principal]);
    case 'referral_memo':
      return base([
        ['رقم الإحالة', dash(c.referral?.referral_no)], ['تاريخ الإحالة', c.fmt(c.referral?.referred_on)], ['سبب الإحالة', dash(c.referral?.reason)],
      ], 'تُحال الحالة المبينة أعلاه إلى لجنة الانضباط الطلابي للنظر فيها وفق لائحة الانضباط الطلابي.', [SIGN.principal, SIGN.committee]);
    case 'investigation_minutes':
      return base([['رقم الإحالة', dash(c.referral?.referral_no)], ['محضر التحقيق', dash(c.referral?.investigation_minutes)], ['الأدلة', dash(c.referral?.evidence_notes)]], undefined, [SIGN.committee, SIGN.counselor, SIGN.guardian]);
    case 'statements':
      return base([['أقوال الطالب', dash(c.referral?.student_statement)], ['أقوال الشهود', dash(c.referral?.witness_statements)]], undefined, [SIGN.student, SIGN.guardian, SIGN.committee]);
    case 'committee_recommendation':
      return base([['رقم الإحالة', dash(c.referral?.referral_no)], ['التوصية', dash(c.referral?.recommendation)], ['تاريخ التوصية', c.fmt(c.referral?.recommendation_date)], ['جهة الاعتماد', dash(c.referral?.approving_authority)], ['المراجع', dash(c.referral?.reviewer_name)]], undefined, [SIGN.committee, SIGN.principal]);
    case 'decision_notice':
      return base([['رقم الإحالة', dash(c.referral?.referral_no)], ['القرار', dash(c.referral?.final_decision)], ['تاريخ القرار', c.fmt(c.referral?.decision_date)]], 'نفيدكم بالقرار المبين أعلاه. ولولي الأمر حق التظلم كتابيًا وفق المدة المقررة في اللائحة.', [SIGN.principal, SIGN.guardian]);
    case 'followup':
      return base([...actRows, ['تاريخ التنفيذ', c.fmt(act?.executed_on)], ['نتيجة المتابعة', dash(act?.followup_result)]], undefined, [SIGN.staff, SIGN.counselor, SIGN.principal]);
    case 'appeal':
      return base([['رقم الإحالة', dash(c.referral?.referral_no)], ['القرار محل التظلم', dash(c.referral?.final_decision)], ['أسباب التظلم', '................................................................']], undefined, [SIGN.guardian, SIGN.principal]);
    case 'student_ledger':
      return {
        title: label,
        sections: [
          { heading: 'بيانات الطالب', rows: studentRows(c) },
          {
            heading: 'الوقائع',
            table: {
              head: ['التاريخ', 'الرقم', 'المخالفة', 'الفئة', 'الحالة', 'الإجراءات'],
              rows: (c.studentIncidents ?? []).map((x) => [
                c.fmt(x.incident.incident_date), x.incident.ref_no, `${x.violation?.code ?? ''} ${x.violation?.official_name ?? ''}`,
                x.category?.name ?? '', INCIDENT_STATUS_LABELS[x.incident.status],
                x.actions.map((a) => ACTION_LABELS[a.action_type] + (a.pledge_no ? ` (${pledgeLabel(a.pledge_no)})` : '')).join('، ') || '—',
              ]),
            },
          },
        ],
        signatures: [SIGN.counselor, SIGN.principal],
      };
    case 'class_report':
      return {
        title: `${label} — ${c.className ?? ''}`,
        sections: [
          {
            table: {
              head: ['الطالب', 'الرقم المدرسي', ...(c.categories ?? []).map((k) => k.name), 'المجموع'],
              rows: (c.classRows ?? []).map((r) => [r.student.name, dash(r.student.school_number), ...r.counts.map(String), String(r.total)]),
            },
          },
        ],
        signatures: [SIGN.counselor, SIGN.principal],
      };
    default:
      return base();
  }
}
