export type Role = 'admin' | 'supervisor';

export type Profile = {
  user_id: string;
  full_name: string;
  role: Role;
  active: boolean;
  email?: string | null;
};

export type Category = {
  id: number;
  name: string;
  article: string;
  symbol: string;
  color: string;
  remedies_summary: string[];
  remedies_status: string;
};

export type CatalogStatus = 'pending_review' | 'verified' | 'superseded';

export type Violation = {
  id: string;
  code: string;
  version: number;
  category_id: number;
  article: string | null;
  clause: string | null;
  official_name: string;
  description: string | null;
  reference_text: string | null;
  allowed_remedies: string[];
  remedy_conditions: string | null;
  applicable_stages: string[];
  applicable_grades: string[];
  approval_requirements: string | null;
  status: CatalogStatus;
  last_reviewed: string | null;
  source: string | null;
};

export type IncidentStatus =
  | 'new' | 'closed';

export type Incident = {
  id: string;
  ref_no: string;
  student_id: string;
  class_id: string | null;
  violation_id: string;
  incident_date: string;
  incident_time: string;
  location: string;
  description: string;
  observer_name: string;
  witnesses: string | null;
  status: IncidentStatus;
  source_attendance_date: string | null;
  source_attendance_status: string | null;
  professional_notes: string | null;
  created_at: string;
};

export type ActionType =
  | 'guidance' | 'verbal_warning' | 'written_warning' | 'guardian_summons' | 'pledge'
  | 'extra_tasks' | 'apology' | 'committee_referral' | 'investigation'
  | 'recommendation' | 'decision' | 'followup_closure' | 'activity_suspension' | 'manazil_transfer'
  | 'device_confiscation' | 'class_suspension' | 'class_transfer' | 'bus_suspension' | 'grade_cancellation' | 'zero_results';

export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export type IncidentAction = {
  id: string;
  incident_id: string;
  action_type: ActionType;
  action_no: number;
  pledge_no: number | null;
  action_date: string;
  responsible_staff: string;
  reason: string;
  relation_note: string | null;
  document_text: string | null;
  approval_status: ApprovalStatus;
  guardian_notified_on: string | null;
  executed_on: string | null;
  followup_result: string | null;
  followup_due: string | null;
  notes: string | null;
  created_at: string;
};

export type SummonsStatus =
  | 'draft' | 'ready_to_print' | 'guardian_notified' | 'awaiting'
  | 'attended' | 'absent' | 'rescheduled' | 'completed';

export type Summons = {
  id: string;
  summons_no: string;
  student_id: string;
  incident_id: string | null;
  guardian_name: string | null;
  contact: string | null;
  reason: string;
  created_on: string;
  proposed_at: string | null;
  status: SummonsStatus;
  whatsapp_sent_on: string | null;
  attended_on: string | null;
  meeting_summary: string | null;
  resulting_action_id: string | null;
  documented_by: string | null;
};

export type Referral = {
  id: string;
  referral_no: string;
  incident_id: string;
  student_id: string;
  referred_on: string;
  reason: string;
  investigation_minutes: string | null;
  student_statement: string | null;
  witness_statements: string | null;
  evidence_notes: string | null;
  recommendation: string | null;
  recommendation_date: string | null;
  reviewer_name: string | null;
  approving_authority: string | null;
  final_decision: string | null;
  decision_date: string | null;
  guardian_notified_on: string | null;
  appeal_status: 'none' | 'submitted' | 'accepted' | 'rejected';
  appeal_date: string | null;
  followup_notes: string | null;
  status: 'open' | 'recommendation_submitted' | 'decision_issued' | 'followup' | 'closed';
};

export type DocRow = {
  id: string;
  doc_no: string;
  doc_type: string;
  student_id: string | null;
  incident_id: string | null;
  action_id: string | null;
  referral_id: string | null;
  summons_id: string | null;
  status: 'draft' | 'approved';
  content: Record<string, unknown>;
  created_at: string;
};

export type SchoolSettings = {
  country: string;
  authority: string;
  school_name: string;
  school_logo_url: string | null;
  ministry_logo_url: string | null;
  academic_year: string | null;
  term: string | null;
  principal_name: string | null;
  officer_name: string | null;
  print_header_note: string | null;
  weekend_days: number[];
  committee_recommendation_days: number;
  guardian_notice_days: number;
  appeal_days: number;
  periods_verified: boolean;
};

export type ClassX = {
  id: string;
  name: string;
  order_index: number;
  stage: string | null;
  grade_level: string | null;
};

export type StudentX = {
  id: string;
  name: string;
  class_id: string;
  school_number: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
};
