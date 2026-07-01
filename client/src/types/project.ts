

export type ProjectBailen = {
    project_bailen_id: number,
    project_bailen_name: string,
    project_bailen_location: string,
    project_bailen_location_code: string,
    project_bailen_administrator_name: string,
    project_bailen_tax_declaration_no: string,
    project_bailen_pin: string,
    project_bailen_status: 'active' | 'inactive',
    project_bailen_created_at: string,
    project_bailen_updated_at: string
}

export type BailenCadastralLotNumber = {
    bailen_cadastral_lot_number_id: number,
    project_bailen_id: number,
    bailen_cadastral_lot_number: string,
    bailen_cadastral_lot_number_created_at: string,
    bailen_cadastral_lot_number_updated_at: string
}
export type BailenDefaultDocument = {
    default_document_id: number,
    project_bailen_id: number,
    document_id: number,
}

export type ProjectMaragondon = {
}

export type ProjectGeneralTrias = {

}

