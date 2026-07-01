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

export type BailenListingClientProfile = {
  client_id: number | null;
  buyer_type: BailenBuyerType;
  primary_buyer: {
    full_name: string;
    email: string;
    contact_no: string;
    address: string;
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
    employment_status:
      | "Employed - Private"
      | "Employed - Government"
      | "Employed - NGO"
      | "Self-Employed";
    employer_or_business_name: string;
    monthly_income: number;
  };
  second_buyer: null | {
    full_name: string;
    email: string;
    contact_no: string;
    relationship_label: "Spouse" | "Co-buyer";
    employer_or_business_name: string;
    monthly_income: number;
  };
  profile_status: "missing" | "draft" | "complete";
  saved_at: string | null;
};

export type BailenListingPaymentTerms = {
  payment_mode: BailenPaymentMode;
  term_months: 0 | 36 | 60;
  first_due_date: string | null;
  reservation_paid: boolean;
  downpayment_percent: number;
  downpayment_months: number;
  monthly_amortization: number;
  balance: number;
};

export type BailenListingCommissionSnapshot = {
  seller_name: string | null;
  seller_group_name: string | null;
  seller_rate_bailen: number;
  commission_pool_rate_bailen: number;
  commission_status:
    | "not_ready"
    | "pending"
    | "eligible"
    | "partially_released"
    | "released";
};

export type Bailen_Lot_Listing = {
  bailen_lot_listing_id: number;
  client_id: null | number;
  accredited_seller_id: null | number;
  bailen_lot_listing_project_id: number;

  /**
   * Stored as plain unit number/code from project inventory.
   * Example display can be `LA-0203`.
   */
  bailen_lot_listing_unit_id: number;
  bailen_lot_listing_unit_code: string;
  bailen_lot_listing_old_unit_ids: string[];

  bailen_lot_listing_lot_type: BailenLotType;
  bailen_lot_listing_reservation_fee: number;
  bailen_lot_listing_price_sqm: number;
  bailen_lot_listing_lot_area_sqm: number;

  /**
   * Deprecated typo support. Keep this temporarily so old code does not break.
   */
  bailen_lot_listing_lot_are_sqm?: number;

  bailen_lot_listing_legal_misc_rate: number;
  bailen_lot_listing_annual_interest_rate: number;

  bailen_lot_listing_net_selling_price: number;
  bailen_lot_listing_legal_misc_fee: number;
  bailen_lot_listing_total_contract_price: number;

  bailen_lot_listing_status: BailenListingStatus;
  bailen_lot_listing_documents: Document[];

  /**
   * Client profile is intentionally saved per listing/unit.
   * If one buyer buys 3 units, each listing keeps its own buyer/profile snapshot.
   */
  bailen_lot_listing_client_profile: BailenListingClientProfile | null;
  bailen_lot_listing_payment_terms: BailenListingPaymentTerms | null;
  bailen_lot_listing_commission_snapshot: BailenListingCommissionSnapshot | null;

  bailen_lot_listing_created_at: string;
  bailen_lot_listing_updated_at: string;
};

export type Maragondon_Lot_Listing = {};

export type Gentri_HouseAndLot_Listing = {};
