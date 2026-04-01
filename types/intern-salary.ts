export type InternProfile = {
  slack_user_id: string;
  name: string;
  phone: string;
  bank_info: string;
  unit_price: number;
  updated_at: string;
};

export type InternSalarySubmission = {
  id: string;
  intern_id: string;
  intern_name: string;
  month: string;
  unit_price: number;
  working_hours: number;
  expense_transport: number;
  expense_travel: number;
  expense_ai: number;
  total_salary: number;
  total_expense: number;
  total_amount: number;
  bank_info: string;
  payment_due: string;
  status: "submitted" | "paid";
  submitted_at: string;
  paid_at: string | null;
};

export type InternSalaryPending = Omit<
  InternSalarySubmission,
  "id" | "status" | "submitted_at" | "paid_at"
> & {
  pending_since: string;
};
