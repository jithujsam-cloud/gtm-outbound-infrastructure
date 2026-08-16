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
          llm_api_key: string | null
          llm_provider: string
          supabase_url: string | null
          supabase_anon_key: string | null
          supabase_service_role_key: string | null
          clearout_requests_per_minute: number
          clearout_timeout_seconds: number
          clearout_next_request_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          clearout_api_key?: string | null
          llm_api_key?: string | null
          llm_provider?: string
          supabase_url?: string | null
          supabase_anon_key?: string | null
          supabase_service_role_key?: string | null
          clearout_requests_per_minute?: number
          clearout_timeout_seconds?: number
          clearout_next_request_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          clearout_api_key?: string | null
          llm_api_key?: string | null
          llm_provider?: string
          supabase_url?: string | null
          supabase_anon_key?: string | null
          supabase_service_role_key?: string | null
          clearout_requests_per_minute?: number
          clearout_timeout_seconds?: number
          clearout_next_request_at?: string | null
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
          model: string | null
          request_id: string | null
          leads_in_request: number | null
          input_tokens: number | null
          cached_input_tokens: number | null
          output_tokens: number | null
          total_tokens: number | null
          input_cost: number | null
          cached_input_cost: number | null
          output_cost: number | null
          total_cost: number | null
          request_metadata: Record<string, unknown> | null
          response_metadata: Record<string, unknown> | null
          raw_response: Record<string, unknown> | null
          raw_error: Record<string, unknown> | null
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
          model?: string | null
          request_id?: string | null
          leads_in_request?: number | null
          input_tokens?: number | null
          cached_input_tokens?: number | null
          output_tokens?: number | null
          total_tokens?: number | null
          input_cost?: number | null
          cached_input_cost?: number | null
          output_cost?: number | null
          total_cost?: number | null
          request_metadata?: Record<string, unknown> | null
          response_metadata?: Record<string, unknown> | null
          raw_response?: Record<string, unknown> | null
          raw_error?: Record<string, unknown> | null
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
          model?: string | null
          request_id?: string | null
          leads_in_request?: number | null
          input_tokens?: number | null
          cached_input_tokens?: number | null
          output_tokens?: number | null
          total_tokens?: number | null
          input_cost?: number | null
          cached_input_cost?: number | null
          output_cost?: number | null
          total_cost?: number | null
          request_metadata?: Record<string, unknown> | null
          response_metadata?: Record<string, unknown> | null
          raw_response?: Record<string, unknown> | null
          raw_error?: Record<string, unknown> | null
          created_at?: string
        }
      }
      validation_jobs: {
        Row: {
          id: string
          user_id: string
          project_id: string
          type: string
          mode: string
          prompt: string | null
          model: string | null
          llm_provider: string | null
          status: string
          total_leads: number
          completed_leads: number
          failed_leads: number
          skipped_leads: number
          error_message: string | null
          provider_reset_at: string | null
          requests_per_minute: number | null
          timeout_seconds: number | null
          created_at: string
          started_at: string | null
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          type: string
          mode: string
          prompt?: string | null
          model?: string | null
          llm_provider?: string | null
          status?: string
          total_leads?: number
          completed_leads?: number
          failed_leads?: number
          skipped_leads?: number
          error_message?: string | null
          provider_reset_at?: string | null
          requests_per_minute?: number | null
          timeout_seconds?: number | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          type?: string
          mode?: string
          prompt?: string | null
          model?: string | null
          llm_provider?: string | null
          status?: string
          total_leads?: number
          completed_leads?: number
          failed_leads?: number
          skipped_leads?: number
          error_message?: string | null
          provider_reset_at?: string | null
          requests_per_minute?: number | null
          timeout_seconds?: number | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
      }
      validation_job_items: {
        Row: {
          id: string
          job_id: string
          lead_id: string
          status: string
          attempt: number
          max_attempts: number
          error_message: string | null
          lease_expires_at: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          next_attempt_at: string | null
        }
        Insert: {
          id?: string
          job_id: string
          lead_id: string
          status?: string
          attempt?: number
          max_attempts?: number
          error_message?: string | null
          lease_expires_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          next_attempt_at?: string | null
        }
        Update: {
          id?: string
          job_id?: string
          lead_id?: string
          status?: string
          attempt?: number
          max_attempts?: number
          error_message?: string | null
          lease_expires_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          next_attempt_at?: string | null
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
