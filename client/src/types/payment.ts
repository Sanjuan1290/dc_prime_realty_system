export type PaymentStatus = "pending" | "verified" | "rejected";
export type PaymentMethod = "cash" | "bank_transfer" | "online";
export type PaymentType =
  | "reservation"
  | "downpayment"
  | "monthly_amortization"
  | "legal_misc"
  | "full_payment"
  | "other";

export type BailenPaymentRecord = {
  payment_id: number;
  listing_id: number;
  client_name: string;
  unit_code: string;
  project_name: "Bailen";
  amount: number;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  reference_id: string;
  payment_date: string;
  verified_by: string | null;
  verified_date: string | null;
  status: PaymentStatus;
  remarks: string | null;
};

export type BailenSOARow = {
  due_id: number;
  listing_id: number;
  due_date: string;
  description: string;
  beginning_balance: number;
  due_amount: number;
  interest: number;
  principal_paid: number;
  penalty: number;
  date_paid: string | null;
  amount_paid: number;
  reference_id: string | null;
  status: "unpaid" | "paid" | "advance" | "partial" | "overdue";
  ending_balance: number;
};
