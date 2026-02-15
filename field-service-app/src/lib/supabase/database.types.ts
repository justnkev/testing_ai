export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            communication_logs: {
                Row: {
                    channel: string
                    created_at: string
                    customer_id: string
                    error_message: string | null
                    id: string
                    job_id: string
                    notification_type: string
                    payload: Json | null
                    provider_message_id: string | null
                    sent_at: string | null
                    status: string
                }
                Insert: {
                    channel: string
                    created_at?: string
                    customer_id: string
                    error_message?: string | null
                    id?: string
                    job_id: string
                    notification_type: string
                    payload?: Json | null
                    provider_message_id?: string | null
                    sent_at?: string | null
                    status?: string
                }
                Update: {
                    channel?: string
                    created_at?: string
                    customer_id?: string
                    error_message?: string | null
                    id?: string
                    job_id?: string
                    notification_type?: string
                    payload?: Json | null
                    provider_message_id?: string | null
                    sent_at?: string | null
                    status?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "communication_logs_customer_id_fkey"
                        columns: ["customer_id"]
                        isOneToOne: false
                        referencedRelation: "fs_customers"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "communication_logs_job_id_fkey"
                        columns: ["job_id"]
                        isOneToOne: false
                        referencedRelation: "fs_jobs"
                        referencedColumns: ["id"]
                    }
                ]
            }
            fs_customers: {
                Row: {
                    address: string
                    city: string | null
                    created_at: string
                    email: string | null
                    id: string
                    marketing_opt_in: boolean
                    name: string
                    notes: string | null
                    phone: string | null
                    state: string | null
                    updated_at: string
                    user_id: string
                    zip_code: string | null
                }
                Insert: {
                    address: string
                    city?: string | null
                    created_at?: string
                    email?: string | null
                    id?: string
                    marketing_opt_in?: boolean
                    name: string
                    notes?: string | null
                    phone?: string | null
                    state?: string | null
                    updated_at?: string
                    user_id: string
                    zip_code?: string | null
                }
                Update: {
                    address?: string
                    city?: string | null
                    created_at?: string
                    email?: string | null
                    id?: string
                    marketing_opt_in?: boolean
                    name?: string
                    notes?: string | null
                    phone?: string | null
                    state?: string | null
                    updated_at?: string
                    user_id?: string
                    zip_code?: string | null
                }
                Relationships: []
            }
            fs_jobs: {
                Row: {
                    check_in_at: string | null
                    completed_at: string | null
                    created_at: string
                    customer_id: string
                    description: string | null
                    estimated_duration_minutes: number | null
                    id: string
                    notes: string | null
                    payment_status: string | null
                    priority: string | null
                    scheduled_date: string
                    scheduled_time: string | null
                    signature_data: string | null
                    signature_name: string | null
                    signed_at: string | null
                    status: string | null
                    technician_id: string | null
                    title: string
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    check_in_at?: string | null
                    completed_at?: string | null
                    created_at?: string
                    customer_id: string
                    description?: string | null
                    estimated_duration_minutes?: number | null
                    id?: string
                    notes?: string | null
                    payment_status?: string | null
                    priority?: string | null
                    scheduled_date: string
                    scheduled_time?: string | null
                    signature_data?: string | null
                    signature_name?: string | null
                    signed_at?: string | null
                    status?: string | null
                    technician_id?: string | null
                    title: string
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    check_in_at?: string | null
                    completed_at?: string | null
                    created_at?: string
                    customer_id?: string
                    description?: string | null
                    estimated_duration_minutes?: number | null
                    id?: string
                    notes?: string | null
                    payment_status?: string | null
                    priority?: string | null
                    scheduled_date?: string
                    scheduled_time?: string | null
                    signature_data?: string | null
                    signature_name?: string | null
                    signed_at?: string | null
                    status?: string | null
                    technician_id?: string | null
                    title?: string
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "fs_jobs_customer_id_fkey"
                        columns: ["customer_id"]
                        isOneToOne: false
                        referencedRelation: "fs_customers"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "fs_jobs_technician_id_fkey"
                        columns: ["technician_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {}
        Functions: {}
        Enums: {}
        CompositeTypes: {}
    }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Row"]

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Update"]
