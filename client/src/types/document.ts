

export type Template = {
    template_id: number,
    template_name: string,
    template_description: string,
    template_status: 'active' | 'inactive',
    template_created_at: string,
    template_updated_at: string
}

export type DocumentTemplateList = {
    document_template_list_id: number,
    template_id: number,
    document_id: number,
    template_created_at: string,
    template_updated_at: string
}   

export type Document = {
    document_id: number,
    document_name: string,
    document_description: string,
    document_is_reusable: boolean,
    document_status: 'active' | 'inactive',
    document_is_required: boolean
    document_created_at: string,
    document_updated_at: string
}