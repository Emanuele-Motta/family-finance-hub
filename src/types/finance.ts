export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferred_currency: string;
  language: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  invite_code: string;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  family_group_id: string;
  role: 'admin' | 'member';
}

export interface Category {
  id: string;
  family_group_id: string | null;
  name: string;
  icon: string;
  type: 'income' | 'expense';
  color: string;
  is_default: boolean;
}

export interface Transaction {
  id: string;
  family_group_id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  notes: string | null;
  recurring: boolean;
  recurrence_type: 'monthly' | 'yearly' | null;
  tags: string[] | null;
  created_at: string;
}

export interface Budget {
  id: string;
  family_group_id: string;
  category_id: string | null;
  amount: number;
  period: 'monthly' | 'yearly';
}

export interface Goal {
  id: string;
  family_group_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
}

export interface Debt {
  id: string;
  family_group_id: string;
  name: string;
  total_amount: number;
  remaining_amount: number;
  due_date: string | null;
  interest_rate: number | null;
  monthly_payment: number | null;
  notes: string | null;
  is_paid: boolean;
}
