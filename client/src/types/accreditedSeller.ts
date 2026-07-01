
export type AccreditedSeller = {
    accredited_seller_id: number,
    user_id: number,
    seller_group_id: number,
    accredited_seller_reports_under_user_id: null | number, // stil id of accredited seller but higher position
    accredited_seller_assigned_rate_bailen: number,
    accredited_seller_accreditation_date: string,
    accredited_seller_status: 'active' | 'inactive',
}

export type AccreditedSellerManagingSeller = {
    accredited_seller_managing_seller: number,
    accredited_seller_id: number,

}