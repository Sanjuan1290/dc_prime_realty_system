import type { Document } from "./document"

export type Project = {
    project_id: number,
    project_name: string,
    location: string,
    location_code: string,
    administrator_name: string,
    tax_declaration_no: string,
    pin: string,
    cadastral_lot_number: string,
    default_documents: Document[],
    status: 'active' | 'inactive'
}
