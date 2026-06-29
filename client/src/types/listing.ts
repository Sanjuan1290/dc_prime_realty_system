import type { Document } from "./document"

export type Bailen_Lot_Listing = {
    bailen_lot_listing_id: number,
    client_id: null | number,
    accredited_seller_id: null | number,
    bailen_lot_listing_project_id: number,
    bailen_lot_listing_unit_id: number,   //not a table ex. 0101, 0102, 0203
    bailen_lot_listing_old_unit_ids: number[],
    bailen_lot_listing_lot_type: 'inner' | 'corner' | 'end',
    bailen_lot_listing_reservation_fee: number,
    bailen_lot_listing_price_sqm: number,
    bailen_lot_listing_lot_are_sqm: number,
    bailen_lot_listing_legal_misc_rate: number,
    bailen_lot_listing_annual_interest_rate:number,
    bailen_lot_listing_status: 'active' | 'inactive',
    bailen_lot_listing_documents: Document[],

    bailen_lot_listing_created_at: string,
    bailen_lot_listing_updated_at: string
}

export type Maragondon_Lot_Listing = {
    maragondon_lot_listing_id: number,
    maragondon_project_id: number,
    maragondon_unit_id: number,
    maragondon_old_unit_ids: number[],
    maragondon_lot_type: 'inner' | 'corner' | 'end',
    maragondon_reservation_fee: number,
    maragondon_price_sqm: number,
    maragondon_lot_are_sqm: number,
    maragondon_legal_misc_rate: number,
    maragondon_annual_interest_rate:number,
    maragondon_status: 'active' | 'inactive',
    maragondon_documents: Document[],
    maragondon_created_at: string,
    maragondon_updated_at: string
}

export type Gentri_HouseAndLot_Listing = {
    
}
