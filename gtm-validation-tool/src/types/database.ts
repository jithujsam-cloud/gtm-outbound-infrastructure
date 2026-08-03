export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          project_id: string
          full_name: string
          company_name: string
          position: string
          email: string
          industry: string
          state: string
          domain: string
          employee_size: number | null
          country: string
          company_description: string
          company_linkedin: string
          linkedin_url: string
          website: string
          email_check: string | null
          ai_summary: string | null
          vertical_match: boolean | null
          matched_vertical: string | null
          reasoning: string | null
          email_score: number | null
          status: string | null
          safe_to_send: boolean | null
          smtp_provider: string | null
          mx_record: string | null
          account: string | null
          clearout_domain: string | null
          ai_response: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          full_name: string
          company_name: string
          position: string
          email: string
          industry: string
          state: string
          domain: string
          employee_size?: number | null
          country: string
          company_description: string
          company_linkedin: string
          linkedin_url: string
          website: string
          email_check?: string | null
          ai_summary?: string | null
          vertical_match?: boolean | null
          matched_vertical?: string | null
          reasoning?: string | null
          email_score?: number | null
          status?: string | null
          safe_to_send?: boolean | null
          smtp_provider?: string | null
          mx_record?: string | null
          account?: string | null
          clearout_domain?: string | null
          ai_response?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          full_name?: string
          company_name?: string
          position?: string
          email?: string
          industry?: string
          state?: string
          domain?: string
          employee_size?: number | null
          country?: string
          company_description?: string
          company_linkedin?: string
          linkedin_url?: string
          website?: string
          email_check?: string | null
          ai_summary?: string | null
          vertical_match?: boolean | null
          matched_vertical?: string | null
          reasoning?: string | null
          email_score?: number | null
          status?: string | null
          safe_to_send?: boolean | null
          smtp_provider?: string | null
          mx_record?: string | null
          account?: string | null
          clearout_domain?: string | null
          ai_response?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
