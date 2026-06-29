

export type SellerGroup = {
    seller_group_id: number,
    seller_group_name: string,
    seller_group_pool_rate_bailen: number,
    seller_group_pool_rate_maragondon: number,
    seller_group_pool_rate_general_trias: number,
    seller_group_head: null | string,
    seller_group_description: string,
    seller_group_status: 'active' | 'inactive',
    seller_group_created_at: string,
    seller_group_updated_at: string
}