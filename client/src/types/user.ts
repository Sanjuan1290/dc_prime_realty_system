

export type User = {
    id: number,
    first_name: string,
    last_name: string,
    middle_name: string | null,
    contact_no: string,
    email: string,
    // password_hash: string,
    role: 'super_admin' | 
            'admin' | 
            'broker_network_manager' |
            'broker' |
            'manager' |
            'agent',
    status: 'active' | 'inactive'
    must_change_password: boolean,
    last_login: string | null,
    created_at: string,
    updated_at: string
}
