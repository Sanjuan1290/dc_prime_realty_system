export type SellerGroupStatus = "active" | "inactive";

export type SellerGroup = {
  seller_group_id: number;
  seller_group_name: string;
  seller_group_pool_rate_bailen: number;
  seller_group_pool_rate_maragondon: number;
  seller_group_pool_rate_general_trias: number;
  seller_group_head_user_id: number | null;
  group_head_name?: string | null;
  seller_group_description: string | null;
  seller_group_status: SellerGroupStatus;
  seller_group_created_at: string;
  seller_group_updated_at: string;
};
