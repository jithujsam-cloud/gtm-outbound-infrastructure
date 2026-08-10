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
          user_id: string | null
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
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
          user_id: string | null
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
          user_id: string
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
          user_id?: string
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
      integration_settings: {
        Row: {
          id: string
          user_id: string
          clearout_api_key: string | null
          gemini_api_key: string | null
          supabase_url: string | null
          supabase_anon_key: string | null
          supabase_service_role_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          clearout_api_key?: string | null
          gemini_api_key?: string | null
          supabase_url?: string | null
          supabase_anon_key?: string | null
          supabase_service_role_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          clearout_api_key?: string | null
          gemini_api_key?: string | null
          supabase_url?: string | null
          supabase_anon_key?: string | null
          supabase_service_role_key?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      validation_prompts: {
        Row: {
          id: string
          user_id: string
          project_id: string
          type: string
          prompt: string
          model: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          type: string
          prompt: string
          model?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          type?: string
          prompt?: string
          model?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      api_operation_logs: {
        Row: {
          id: string
          user_id: string
          project_id: string
          lead_id: string | null
          job_id: string | null
          job_item_id: string | null
          provider: string
          operation: string
          status: string
          attempt: number
          duration_ms: number | null
          http_status: number | null
          error_code: string | null
          error_message: string | null
          request_metadata: Record<string, unknown> | null
          response_metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          lead_id?: string | null
          job_id?: string | null
          job_item_id?: string | null
          provider: string
          operation: string
          status: string
          attempt?: number
          duration_ms?: number | null
          http_status?: number | null
          error_code?: string | null
          error_message?: string | null
          request_metadata?: Record<string, unknown> | null
          response_metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          lead_id?: string | null
          job_id?: string | null
          job_item_id?: string | null
          provider?: string
          operation?: string
          status?: string
          attempt?: number
          duration_ms?: number | null
          http_status?: number | null
          error_code?: string | null
          error_message?: string | null
          request_metadata?: Record<string, unknown> | null
          response_metadata?: Record<string, unknown> | null
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
