

export type Template = {
    template_id: number
    template_name: string,
    template_description: string,
    status: 'active' | 'inactive'
}

export type Document = {
    document_id: number,
    template_id: number,
    document_name: string,
    document_description: string,
    isReusable: boolean,
    status: 'active' | 'inactive'
}