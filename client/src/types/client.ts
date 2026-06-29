

export  type Client = {
    client_id: number,
    unit_ids: number,
    client_full_name: string,
    client_email: string,
    client_contact_no: string
    client_address: string,
    client_birth_date: string,
    client_place_of_birth: string,
    client_citizenship: string,
    client_gender: 'male' | 'female' | 'other',
    client_civil_status: 'Single' | 
    'Married' | 
    'Separated' | 
    'Annulled / Divorce' |
    'Widower',
    client_residence_contact_no: string,
    client_tin: string,
    client_present_zip_code: string,
    client_permanent_address: string,
    client_permanent_zip_code: string,
    client_employment_status: 'Employed - Private' |
    'Employed - Government' |
    'Employed - NGO' |
    'Self-Employed',
    client_created_at: string,
    updated_at: string
}