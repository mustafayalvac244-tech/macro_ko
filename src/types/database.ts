export type InstanceStage = 'ilk_derece' | 'istinaf' | 'temyiz';
export type FirstInstancePhase = 'dilekceler' | 'on_inceleme' | 'tahkikat' | 'bilirkisi_kesif' | 'karar';
export type ClosedResult = 'kabul' | 'ret' | 'kismen_kabul' | 'diger';
export type CourtCategory = 'hukuk' | 'ceza' | 'idare';
export type CaseStatus = 'active' | 'pending' | 'on_hold' | 'closed' | 'won' | 'lost';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';
export type HearingType = 'hearing' | 'trial' | 'mediation' | 'deposition' | 'filing' | 'meeting' | 'other';
export type DocumentCategory =
  | 'pleading'
  | 'contract'
  | 'evidence'
  | 'correspondence'
  | 'court_order'
  | 'invoice'
  | 'identification'
  | 'client_photo'
  | 'other';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  firm_name: string | null;
  bar_number: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_premium?: boolean;
  is_admin?: boolean;
  created_at: string;
  updated_at: string;
}

export type ClientType = 'gercek' | 'tuzel';

export interface Client {
  id: string;
  owner_id: string;
  full_name: string;
  title: string | null;
  client_type: ClientType | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  owner_id: string;
  client_id: string | null;
  title: string;
  case_number: string | null;
  court_name: string | null;
  court_category: CourtCategory | null;
  case_type: string | null;
  status: CaseStatus;
  priority: PriorityLevel;
  opposing_party: string | null;
  opposing_counsel: string | null;
  instance_stage: InstanceStage | null;
  case_stage: FirstInstancePhase | null;
  closed_result: ClosedResult | null;
  decision_number: string | null;
  decision_date: string | null;
  decision_served_date: string | null;
  description: string | null;
  opened_date: string;
  closed_date: string | null;
  fee_amount: number | null;
  fee_type: FeeType | null;
  fee_percent: number | null;
  fee_advance: number | null;
  advance_amount: number | null;
  created_at: string;
  updated_at: string;
}

export type FeeType = 'percentage' | 'advance_percentage' | 'fixed';

export interface CaseInstallment {
  id: string;
  owner_id: string;
  case_id: string;
  seq: number;
  amount: number;
  due_date: string | null;
  is_paid: boolean;
  created_at: string;
}

export interface CaseExpense {
  id: string;
  owner_id: string;
  case_id: string;
  title: string;
  amount: number;
  spent_at: string;
  created_at: string;
}

export type JobType = 'tevkil' | 'devir' | 'danisma';
export type JobStatus = 'open' | 'assigned' | 'closed';

export interface DmMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Job {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  job_type: JobType;
  city: string;
  courthouse: string | null;
  hearing_date: string | null;
  fee_offer: number | null;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

export interface JobWithOwner extends Job {
  owner: Pick<Profile, 'id' | 'full_name' | 'firm_name'> | null;
}

export type PublicProfile = Pick<Profile, 'id' | 'full_name' | 'firm_name' | 'bar_number' | 'avatar_url' | 'is_premium'>;

export interface PaymentPromise {
  id: string;
  owner_id: string;
  client_id: string;
  case_id: string | null;
  amount: number;
  due_date: string;
  note: string | null;
  is_paid: boolean;
  created_at: string;
}

export interface Office {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface OfficeMember {
  office_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface OfficeMessage {
  id: string;
  office_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export type FinanceKind = 'income' | 'expense';
export type FinanceCategory =
  | 'rent'
  | 'salary'
  | 'office'
  | 'utilities'
  | 'transport'
  | 'courtFee'
  | 'tax'
  | 'fee'
  | 'consultation'
  | 'retainer'
  | 'other';

export interface FinanceEntry {
  id: string;
  owner_id: string;
  kind: FinanceKind;
  category: FinanceCategory;
  title: string;
  amount: number;
  entry_date: string;
  is_recurring: boolean;
  recurring_until: string | null;
  note: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  owner_id: string;
  case_id: string;
  amount: number;
  note: string | null;
  paid_at: string;
  created_at: string;
}

export interface CaseWithClient extends Case {
  client: Pick<Client, 'id' | 'full_name' | 'company'> | null;
}

export interface Hearing {
  id: string;
  owner_id: string;
  case_id: string;
  title: string;
  type: HearingType;
  location: string | null;
  scheduled_at: string;
  reminder_minutes_before: number;
  notes: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Deadline {
  id: string;
  owner_id: string;
  case_id: string;
  title: string;
  description: string | null;
  due_at: string;
  priority: PriorityLevel;
  reminder_minutes_before: number;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaseDocument {
  id: string;
  owner_id: string;
  case_id: string | null;
  client_id?: string | null;
  name: string;
  category: DocumentCategory;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  uploaded_at: string;
}

export interface HearingWithCase extends Hearing {
  case: Pick<Case, 'id' | 'title' | 'case_number'> | null;
}

export interface DeadlineWithCase extends Deadline {
  case: Pick<Case, 'id' | 'title' | 'case_number'> | null;
}

export interface DocumentWithCase extends CaseDocument {
  case: Pick<Case, 'id' | 'title' | 'case_number'> | null;
}

