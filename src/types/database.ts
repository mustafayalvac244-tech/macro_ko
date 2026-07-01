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
  | 'other';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  firm_name: string | null;
  bar_number: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  owner_id: string;
  full_name: string;
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
  case_type: string | null;
  status: CaseStatus;
  priority: PriorityLevel;
  opposing_party: string | null;
  description: string | null;
  opened_date: string;
  closed_date: string | null;
  created_at: string;
  updated_at: string;
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

