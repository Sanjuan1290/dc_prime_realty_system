export type Client = {
  client_id: number;
  unit_ids: number;
  client_full_name: string;
  client_email: string;
  client_contact_no: string;
  client_address: string;
  client_birth_date: string;
  client_place_of_birth: string;
  client_citizenship: string;
  client_gender: "male" | "female" | "other";
  client_civil_status:
    | "Single"
    | "Married"
    | "Separated"
    | "Annulled / Divorce"
    | "Widower";
  client_residence_contact_no: string;
  client_tin: string;
  client_present_zip_code: string;
  client_permanent_address: string;
  client_permanent_zip_code: string;
  client_employment_status:
    | "Employed - Private"
    | "Employed - Government"
    | "Employed - NGO"
    | "Self-Employed";
  client_created_at: string;
  updated_at: string;
};

export type ListingClientProfileStatus = "missing" | "draft" | "complete";

export type ListingClientProfile = {
  listing_id: number;
  client_id: number | null;
  buyer_type: "single" | "spouses" | "and_account";
  primary_buyer_name: string;
  primary_buyer_email: string;
  primary_buyer_contact_no: string;
  primary_buyer_address: string;
  primary_buyer_birth_date: string;
  primary_buyer_place_of_birth: string;
  primary_buyer_citizenship: string;
  primary_buyer_gender: "male" | "female" | "other";
  primary_buyer_civil_status:
    | "Single"
    | "Married"
    | "Separated"
    | "Annulled / Divorce"
    | "Widower";
  primary_buyer_tin: string;
  primary_buyer_valid_id_type: string;
  primary_buyer_valid_id_no: string;
  primary_buyer_employment_status: string;
  primary_buyer_employer_or_business_name: string;
  primary_buyer_monthly_income: number;
  second_buyer_name: string | null;
  second_buyer_email: string | null;
  second_buyer_contact_no: string | null;
  second_buyer_employer_or_business_name: string | null;
  second_buyer_monthly_income: number | null;
  emergency_contact_name: string;
  emergency_contact_no: string;
  emergency_contact_relationship: string;
  profile_status: ListingClientProfileStatus;
};
