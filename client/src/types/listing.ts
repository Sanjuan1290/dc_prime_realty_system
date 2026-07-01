import type { Document } from "./document";

export type BailenListingStatus =
  | "available"
  | "hold"
  | "reserved"
  | "sold"
  | "pending for cancellation"
  | "cancelled";

export type BailenLotType = "inner" | "corner" | "end";

export type BailenBuyerType = "single" | "spouses" | "and_account";

export type BailenPaymentMode = "cash" | "installment";

export type BailenDocumentUploadStatus =
  | "not_available"
  | "missing"
  | "submitted"
  | "approved"
  | "rejected";

export type BailenPaymentType =
  | "reservation"
  | "downpayment"
  | "monthly_amortization"
  | "legal_misc"
  | "full_payment"
  | "advance_payment"
  | "balloon_payment"
  | "other";

export type BailenBuyerPersonalInfo = {
  full_name: string;
  email: string;
  contact_no: string;
  residence_contact_no: string;
  birth_date: string;
  place_of_birth: string;
  citizenship: string;
  gender: "male" | "female" | "other";
  civil_status:
    | "Single"
    | "Married"
    | "Separated"
    | "Annulled / Divorce"
    | "Widower";
  tin: string;
  valid_id_type: string;
  valid_id_no: string;
};

export type BailenBuyerAddressInfo = {
  present_address: string;
  present_zip_code: string;
  permanent_address: string;
  permanent_zip_code: string;
};

export type BailenBuyerWorkInfo = {
  employment_status:
    | "Employed - Private"
    | "Employed - Government"
    | "Employed - NGO"
    | "Self-Employed"
    | "Business Owner"
    | "OFW"
    | "Unemployed";
  employer_or_business_name: string;
  position_or_business_type: string;
  work_address: string;
  monthly_income: number;
  source_of_funds: string;
};

export type BailenBuyerProfile = BailenBuyerPersonalInfo &
  BailenBuyerAddressInfo &
  BailenBuyerWorkInfo;

export type BailenListingClientProfile = {
  client_profile_id: number | null;
  client_id: number | null;
  buyer_type: BailenBuyerType;
  primary_buyer: BailenBuyerProfile;
  second_buyer: null | (BailenBuyerProfile & {
    relationship_label: "Spouse" | "Co-buyer";
  });
  emergency_contact_name: string;
  emergency_contact_no: string;
  emergency_contact_relationship: string;
  profile_status: "missing" | "draft" | "complete";
  saved_at: string | null;
};

export type BailenListingPaymentTerms = {
  payment_mode: BailenPaymentMode;
  term_months: 0 | 3 | 12 | 18 | 20 | 36 | 60;
  first_due_date: string | null;
  due_day: number | null;
  reservation_paid: boolean;
  reservation_date: string | null;
  downpayment_percent: number;
  downpayment_months: number;
  monthly_amortization: number;
  balloon_payment: number;
  balance: number;
  remarks: string | null;
};

export type BailenListingDocument = Document & {
  upload_status: BailenDocumentUploadStatus;
  uploaded_file_name: string | null;
  uploaded_at: string | null;
  reviewed_by: string | null;
  remarks: string | null;
};

export type BailenListingCommissionSnapshot = {
  seller_name: string;
  seller_group_name: string;
  seller_rate_bailen: number;
  commission_pool_rate_bailen: number;
  commission_status: "not_ready" | "pending" | "eligible" | "released" | "blocked";
};

export type Bailen_Lot_Listing = {
  bailen_lot_listing_id: number;
  client_id: null | number;
  accredited_seller_id: null | number;
  bailen_lot_listing_project_id: number;
  bailen_lot_listing_unit_id: number;
  bailen_lot_listing_unit_code: string;
  bailen_lot_listing_old_unit_ids: string[];
  bailen_lot_listing_cadastral_lot_number_ids: number[];
  bailen_lot_listing_cadastral_lot_numbers: string[];
  bailen_lot_listing_lot_type: BailenLotType;
  bailen_lot_listing_reservation_fee: number;
  bailen_lot_listing_price_sqm: number;
  bailen_lot_listing_lot_area_sqm: number;
  bailen_lot_listing_lot_are_sqm: number;
  bailen_lot_listing_legal_misc_rate: number;
  bailen_lot_listing_annual_interest_rate: number;
  bailen_lot_listing_net_selling_price: number;
  bailen_lot_listing_legal_misc_fee: number;
  bailen_lot_listing_total_contract_price: number;
  bailen_lot_listing_status: BailenListingStatus;
  bailen_lot_listing_documents: BailenListingDocument[];
  bailen_lot_listing_client_profile: BailenListingClientProfile | null;
  bailen_lot_listing_payment_terms: BailenListingPaymentTerms | null;
  bailen_lot_listing_commission_snapshot: BailenListingCommissionSnapshot | null;
  bailen_lot_listing_created_at: string;
  bailen_lot_listing_updated_at: string;
};

export type Maragondon_Lot_Listing = Record<string, never>;

export type Gentri_HouseAndLot_Listing = Record<string, never>;
