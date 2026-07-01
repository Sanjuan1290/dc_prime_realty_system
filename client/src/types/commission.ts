export type CommissionReleaseStage =
  | "20%"
  | "40%"
  | "60%"
  | "75%"
  | "retention";

export type CommissionStatus =
  | "not_ready"
  | "pending"
  | "eligible"
  | "partially_released"
  | "released"
  | "blocked";

export type Commission = {
  commission_id: number;
  listing_id: number;
  unit_code: string;
  client_name: string;
  seller_name: string;
  seller_role: "Broker Network Manager" | "Broker" | "Manager" | "Agent";
  seller_group_id: number;
  seller_group_name: string;
  tcp: number;
  pool_rate: number;
  seller_rate: number;
  gross_commission: number;
  eligible_amount: number;
  released_amount: number;
  cash_advance_deduction: number;
  net_remaining: number;
  next_release_stage: CommissionReleaseStage;
  next_release_date: string;
  status: CommissionStatus;
};
