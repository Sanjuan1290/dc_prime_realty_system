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
    bailen_lot_listing_status: 'available' | 
    'hold' | // if someone wants it but not yet paid for reservation
    'sold' | // paid in reservation or actively paying
    'pending for cancellation' | // pending for settlement 
    'cancelled', // from here we can click back to available
    bailen_lot_listing_documents: Document[],

    bailen_lot_listing_created_at: string,
    bailen_lot_listing_updated_at: string
}





export type Maragondon_Lot_Listing = {
}
export type Gentri_HouseAndLot_Listing = {
}
