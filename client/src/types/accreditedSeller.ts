export type AccreditedSellerStatus = "active" | "inactive";

export type AccreditedSeller = {
  accredited_seller_id: number;
  user_id: number;
  seller_group_id: number | null;
  accredited_seller_reports_under_user_id: number | null;
  accredited_seller_assigned_rate_bailen: number;
  accredited_seller_assigned_rate_maragondon: number;
  accredited_seller_assigned_rate_general_trias: number;
  accredited_seller_accreditation_date: string | null;
  accredited_seller_status: AccreditedSellerStatus;
  accredited_seller_created_at: string;
  accredited_seller_updated_at: string;
};

export type AccreditedSellerManagingSeller = {
  accredited_seller_managing_seller: number;
  accredited_seller_id: number;
};
