export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_import_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          image_path: string
          plan_id: string | null
          raw_text: string | null
          result_json: Json | null
          shipper_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          image_path: string
          plan_id?: string | null
          raw_text?: string | null
          result_json?: Json | null
          shipper_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          image_path?: string
          plan_id?: string | null
          raw_text?: string | null
          result_json?: Json | null
          shipper_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_import_jobs_plan_fk"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "inbound_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_import_jobs_plan_fk"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "v_doc_trace"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "ai_import_jobs_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_import_jobs_hist: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          image_path: string
          plan_id: string | null
          raw_text: string | null
          result_json: Json | null
          shipper_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at: string
          created_by?: string | null
          error_message?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          image_path: string
          plan_id?: string | null
          raw_text?: string | null
          result_json?: Json | null
          shipper_id: string
          status: string
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          image_path?: string
          plan_id?: string | null
          raw_text?: string | null
          result_json?: Json | null
          shipper_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      asn_lines: {
        Row: {
          asn_id: string
          created_at: string
          created_by: string | null
          diff_qty: number | null
          id: string
          item_id: string
          line_no: number
          loaded_qty: number
          order_qty: number
          plan_line_id: string
          received_qty: number
          return_qty: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asn_id: string
          created_at?: string
          created_by?: string | null
          diff_qty?: number | null
          id?: string
          item_id: string
          line_no: number
          loaded_qty?: number
          order_qty: number
          plan_line_id: string
          received_qty?: number
          return_qty?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          asn_id?: string
          created_at?: string
          created_by?: string | null
          diff_qty?: number | null
          id?: string
          item_id?: string
          line_no?: number
          loaded_qty?: number
          order_qty?: number
          plan_line_id?: string
          received_qty?: number
          return_qty?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asn_lines_asn_id_fkey"
            columns: ["asn_id"]
            isOneToOne: false
            referencedRelation: "asns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asn_lines_asn_id_fkey"
            columns: ["asn_id"]
            isOneToOne: false
            referencedRelation: "v_doc_trace"
            referencedColumns: ["asn_id"]
          },
          {
            foreignKeyName: "asn_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asn_lines_plan_line_id_fkey"
            columns: ["plan_line_id"]
            isOneToOne: false
            referencedRelation: "inbound_plan_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      asn_lines_hist: {
        Row: {
          asn_id: string
          created_at: string
          created_by: string | null
          diff_qty: number | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          item_id: string
          line_no: number
          loaded_qty: number
          order_qty: number
          plan_line_id: string
          received_qty: number
          return_qty: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asn_id: string
          created_at: string
          created_by?: string | null
          diff_qty?: number | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          item_id: string
          line_no: number
          loaded_qty: number
          order_qty: number
          plan_line_id: string
          received_qty: number
          return_qty: number
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          asn_id?: string
          created_at?: string
          created_by?: string | null
          diff_qty?: number | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          item_id?: string
          line_no?: number
          loaded_qty?: number
          order_qty?: number
          plan_line_id?: string
          received_qty?: number
          return_qty?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      asns: {
        Row: {
          asn_date: string
          asn_no: string
          center_id: string
          created_at: string
          created_by: string | null
          id: string
          remark: string | null
          shipper_id: string
          status: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string
          vehicle_no: string
        }
        Insert: {
          asn_date: string
          asn_no?: string
          center_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          remark?: string | null
          shipper_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id: string
          vehicle_no?: string
        }
        Update: {
          asn_date?: string
          asn_no?: string
          center_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          remark?: string | null
          shipper_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
          vehicle_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "asns_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asns_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asns_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      asns_hist: {
        Row: {
          asn_date: string
          asn_no: string
          center_id: string
          created_at: string
          created_by: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          remark: string | null
          shipper_id: string
          status: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string
          vehicle_no: string
        }
        Insert: {
          asn_date: string
          asn_no: string
          center_id: string
          created_at: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          remark?: string | null
          shipper_id: string
          status: string
          updated_at: string
          updated_by?: string | null
          vehicle_id: string
          vehicle_no: string
        }
        Update: {
          asn_date?: string
          asn_no?: string
          center_id?: string
          created_at?: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          remark?: string | null
          shipper_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
          vehicle_no?: string
        }
        Relationships: []
      }
      centers: {
        Row: {
          address: string | null
          center_code: string
          center_name: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_default: boolean
          tel: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          center_code: string
          center_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          center_code?: string
          center_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      centers_hist: {
        Row: {
          address: string | null
          center_code: string
          center_name: string
          created_at: string
          created_by: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          is_active: boolean
          is_default: boolean
          tel: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          center_code: string
          center_name: string
          created_at: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          is_active: boolean
          is_default: boolean
          tel?: string | null
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          center_code?: string
          center_name?: string
          created_at?: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      code_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          group_code: string
          group_name: string
          is_active: boolean
          is_system: boolean
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_code: string
          group_name: string
          is_active?: boolean
          is_system?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_code?: string
          group_name?: string
          is_active?: boolean
          is_system?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      code_groups_hist: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          group_code: string
          group_name: string
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          is_active: boolean
          is_system: boolean
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at: string
          created_by?: string | null
          description?: string | null
          group_code: string
          group_name: string
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          is_active: boolean
          is_system: boolean
          sort_order: number
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_code?: string
          group_name?: string
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          is_active?: boolean
          is_system?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      codes: {
        Row: {
          attr1: string | null
          attr2: string | null
          attr3: string | null
          code: string
          code_name: string
          created_at: string
          created_by: string | null
          group_code: string
          is_active: boolean
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attr1?: string | null
          attr2?: string | null
          attr3?: string | null
          code: string
          code_name: string
          created_at?: string
          created_by?: string | null
          group_code: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attr1?: string | null
          attr2?: string | null
          attr3?: string | null
          code?: string
          code_name?: string
          created_at?: string
          created_by?: string | null
          group_code?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codes_group_code_fkey"
            columns: ["group_code"]
            isOneToOne: false
            referencedRelation: "code_groups"
            referencedColumns: ["group_code"]
          },
        ]
      }
      codes_hist: {
        Row: {
          attr1: string | null
          attr2: string | null
          attr3: string | null
          code: string
          code_name: string
          created_at: string
          created_by: string | null
          group_code: string
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          is_active: boolean
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attr1?: string | null
          attr2?: string | null
          attr3?: string | null
          code: string
          code_name: string
          created_at: string
          created_by?: string | null
          group_code: string
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          is_active: boolean
          sort_order: number
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          attr1?: string | null
          attr2?: string | null
          attr3?: string | null
          code?: string
          code_name?: string
          created_at?: string
          created_by?: string | null
          group_code?: string
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      company: {
        Row: {
          address: string | null
          biz_no: string | null
          ceo_name: string | null
          company_name: string
          created_at: string
          created_by: string | null
          email: string | null
          id: number
          tel: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          biz_no?: string | null
          ceo_name?: string | null
          company_name: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: number
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          biz_no?: string | null
          ceo_name?: string | null
          company_name?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: number
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      company_hist: {
        Row: {
          address: string | null
          biz_no: string | null
          ceo_name: string | null
          company_name: string
          created_at: string
          created_by: string | null
          email: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: number
          tel: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          biz_no?: string | null
          ceo_name?: string | null
          company_name: string
          created_at: string
          created_by?: string | null
          email?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: number
          tel?: string | null
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          biz_no?: string | null
          ceo_name?: string | null
          company_name?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: number
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      doc_sequences: {
        Row: {
          last_no: number
          prefix: string
          seq_date: string
        }
        Insert: {
          last_no?: number
          prefix: string
          seq_date: string
        }
        Update: {
          last_no?: number
          prefix?: string
          seq_date?: string
        }
        Relationships: []
      }
      inbound_plan_lines: {
        Row: {
          approved_qty: number | null
          asn_qty: number
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          line_no: number
          plan_id: string
          plan_qty: number
          remark: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_qty?: number | null
          asn_qty?: number
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          line_no: number
          plan_id: string
          plan_qty: number
          remark?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_qty?: number | null
          asn_qty?: number
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          line_no?: number
          plan_id?: string
          plan_qty?: number
          remark?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_plan_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_plan_lines_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "inbound_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_plan_lines_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "v_doc_trace"
            referencedColumns: ["plan_id"]
          },
        ]
      }
      inbound_plan_lines_hist: {
        Row: {
          approved_qty: number | null
          asn_qty: number
          created_at: string
          created_by: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          item_id: string
          line_no: number
          plan_id: string
          plan_qty: number
          remark: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_qty?: number | null
          asn_qty: number
          created_at: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          item_id: string
          line_no: number
          plan_id: string
          plan_qty: number
          remark?: string | null
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          approved_qty?: number | null
          asn_qty?: number
          created_at?: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          item_id?: string
          line_no?: number
          plan_id?: string
          plan_qty?: number
          remark?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      inbound_plans: {
        Row: {
          ai_job_id: string | null
          approved_at: string | null
          approved_by: string | null
          center_id: string
          created_at: string
          created_by: string | null
          id: string
          plan_date: string
          plan_no: string
          reject_reason: string | null
          remark: string | null
          shipper_id: string
          source_type: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_job_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          center_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          plan_date: string
          plan_no?: string
          reject_reason?: string | null
          remark?: string | null
          shipper_id: string
          source_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_job_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          center_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          plan_date?: string
          plan_no?: string
          reject_reason?: string | null
          remark?: string | null
          shipper_id?: string
          source_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_plans_ai_job_id_fkey"
            columns: ["ai_job_id"]
            isOneToOne: false
            referencedRelation: "ai_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_plans_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_plans_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_plans_hist: {
        Row: {
          ai_job_id: string | null
          approved_at: string | null
          approved_by: string | null
          center_id: string
          created_at: string
          created_by: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          plan_date: string
          plan_no: string
          reject_reason: string | null
          remark: string | null
          shipper_id: string
          source_type: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_job_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          center_id: string
          created_at: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          plan_date: string
          plan_no: string
          reject_reason?: string | null
          remark?: string | null
          shipper_id: string
          source_type: string
          status: string
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          ai_job_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          center_id?: string
          created_at?: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          plan_date?: string
          plan_no?: string
          reject_reason?: string | null
          remark?: string | null
          shipper_id?: string
          source_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      items: {
        Row: {
          barcode: string | null
          box_qty: number | null
          created_at: string
          created_by: string | null
          expiry_yn: boolean
          id: string
          internal_code: string
          is_active: boolean
          item_name: string
          lot_yn: boolean
          remark: string | null
          shipper_id: string
          shipper_item_code: string
          spec: string | null
          uom_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          barcode?: string | null
          box_qty?: number | null
          created_at?: string
          created_by?: string | null
          expiry_yn?: boolean
          id?: string
          internal_code?: string
          is_active?: boolean
          item_name: string
          lot_yn?: boolean
          remark?: string | null
          shipper_id: string
          shipper_item_code: string
          spec?: string | null
          uom_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          barcode?: string | null
          box_qty?: number | null
          created_at?: string
          created_by?: string | null
          expiry_yn?: boolean
          id?: string
          internal_code?: string
          is_active?: boolean
          item_name?: string
          lot_yn?: boolean
          remark?: string | null
          shipper_id?: string
          shipper_item_code?: string
          spec?: string | null
          uom_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
        ]
      }
      items_hist: {
        Row: {
          barcode: string | null
          box_qty: number | null
          created_at: string
          created_by: string | null
          expiry_yn: boolean
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          internal_code: string
          is_active: boolean
          item_name: string
          lot_yn: boolean
          remark: string | null
          shipper_id: string
          shipper_item_code: string
          spec: string | null
          uom_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          barcode?: string | null
          box_qty?: number | null
          created_at: string
          created_by?: string | null
          expiry_yn: boolean
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          internal_code: string
          is_active: boolean
          item_name: string
          lot_yn: boolean
          remark?: string | null
          shipper_id: string
          shipper_item_code: string
          spec?: string | null
          uom_code: string
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          barcode?: string | null
          box_qty?: number | null
          created_at?: string
          created_by?: string | null
          expiry_yn?: boolean
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          internal_code?: string
          is_active?: boolean
          item_name?: string
          lot_yn?: boolean
          remark?: string | null
          shipper_id?: string
          shipper_item_code?: string
          spec?: string | null
          uom_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      loading_lines: {
        Row: {
          asn_line_id: string
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          loaded_qty: number
          loading_id: string
          scanned_barcode: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asn_line_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          loaded_qty?: number
          loading_id: string
          scanned_barcode?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          asn_line_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          loaded_qty?: number
          loading_id?: string
          scanned_barcode?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loading_lines_asn_line_id_fkey"
            columns: ["asn_line_id"]
            isOneToOne: false
            referencedRelation: "asn_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loading_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loading_lines_loading_id_fkey"
            columns: ["loading_id"]
            isOneToOne: false
            referencedRelation: "loadings"
            referencedColumns: ["id"]
          },
        ]
      }
      loading_lines_hist: {
        Row: {
          asn_line_id: string
          created_at: string
          created_by: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          item_id: string
          loaded_qty: number
          loading_id: string
          scanned_barcode: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asn_line_id: string
          created_at: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          item_id: string
          loaded_qty: number
          loading_id: string
          scanned_barcode?: string | null
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          asn_line_id?: string
          created_at?: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          item_id?: string
          loaded_qty?: number
          loading_id?: string
          scanned_barcode?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      loadings: {
        Row: {
          asn_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          loading_no: string
          started_at: string
          status: string
          updated_at: string
          updated_by: string | null
          worker_id: string | null
        }
        Insert: {
          asn_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          loading_no?: string
          started_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          worker_id?: string | null
        }
        Update: {
          asn_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          loading_no?: string
          started_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loadings_asn_id_fkey"
            columns: ["asn_id"]
            isOneToOne: true
            referencedRelation: "asns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loadings_asn_id_fkey"
            columns: ["asn_id"]
            isOneToOne: true
            referencedRelation: "v_doc_trace"
            referencedColumns: ["asn_id"]
          },
        ]
      }
      loadings_hist: {
        Row: {
          asn_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          loading_no: string
          started_at: string
          status: string
          updated_at: string
          updated_by: string | null
          worker_id: string | null
        }
        Insert: {
          asn_id: string
          completed_at?: string | null
          created_at: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          loading_no: string
          started_at: string
          status: string
          updated_at: string
          updated_by?: string | null
          worker_id?: string | null
        }
        Update: {
          asn_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          loading_no?: string
          started_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          worker_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          login_id: string
          role: string
          shipper_id: string | null
          tel: string | null
          updated_at: string
          updated_by: string | null
          user_name: string
          user_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id: string
          is_active?: boolean
          login_id: string
          role: string
          shipper_id?: string | null
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
          user_name: string
          user_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          login_id?: string
          role?: string
          shipper_id?: string | null
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
          user_name?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_hist: {
        Row: {
          created_at: string
          created_by: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          is_active: boolean
          login_id: string
          role: string
          shipper_id: string | null
          tel: string | null
          updated_at: string
          updated_by: string | null
          user_name: string
          user_type: string
        }
        Insert: {
          created_at: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          is_active: boolean
          login_id: string
          role: string
          shipper_id?: string | null
          tel?: string | null
          updated_at: string
          updated_by?: string | null
          user_name: string
          user_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          is_active?: boolean
          login_id?: string
          role?: string
          shipper_id?: string | null
          tel?: string | null
          updated_at?: string
          updated_by?: string | null
          user_name?: string
          user_type?: string
        }
        Relationships: []
      }
      receipt_images: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          receipt_line_id: string
          storage_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          receipt_line_id: string
          storage_path: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          receipt_line_id?: string
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_images_receipt_line_id_fkey"
            columns: ["receipt_line_id"]
            isOneToOne: false
            referencedRelation: "receipt_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_images_hist: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          receipt_line_id: string
          storage_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at: string
          created_by?: string | null
          file_name?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          receipt_line_id: string
          storage_path: string
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          receipt_line_id?: string
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      receipt_lines: {
        Row: {
          asn_line_id: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          item_id: string
          lot_no: string | null
          receipt_id: string
          received_qty: number
          remark: string | null
          result_code: string
          return_qty: number
          return_reason_code: string | null
          scanned_barcode: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asn_line_id: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          item_id: string
          lot_no?: string | null
          receipt_id: string
          received_qty?: number
          remark?: string | null
          result_code?: string
          return_qty?: number
          return_reason_code?: string | null
          scanned_barcode?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          asn_line_id?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          item_id?: string
          lot_no?: string | null
          receipt_id?: string
          received_qty?: number
          remark?: string | null
          result_code?: string
          return_qty?: number
          return_reason_code?: string | null
          scanned_barcode?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_lines_asn_line_id_fkey"
            columns: ["asn_line_id"]
            isOneToOne: false
            referencedRelation: "asn_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_lines_hist: {
        Row: {
          asn_line_id: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          item_id: string
          lot_no: string | null
          receipt_id: string
          received_qty: number
          remark: string | null
          result_code: string
          return_qty: number
          return_reason_code: string | null
          scanned_barcode: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asn_line_id: string
          created_at: string
          created_by?: string | null
          expiry_date?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          item_id: string
          lot_no?: string | null
          receipt_id: string
          received_qty: number
          remark?: string | null
          result_code: string
          return_qty: number
          return_reason_code?: string | null
          scanned_barcode?: string | null
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          asn_line_id?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          item_id?: string
          lot_no?: string | null
          receipt_id?: string
          received_qty?: number
          remark?: string | null
          result_code?: string
          return_qty?: number
          return_reason_code?: string | null
          scanned_barcode?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      receipts: {
        Row: {
          asn_id: string
          center_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          receipt_date: string
          receipt_no: string
          remark: string | null
          shipper_id: string
          started_at: string
          status: string
          updated_at: string
          updated_by: string | null
          worker_id: string | null
        }
        Insert: {
          asn_id: string
          center_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          receipt_date?: string
          receipt_no?: string
          remark?: string | null
          shipper_id: string
          started_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          worker_id?: string | null
        }
        Update: {
          asn_id?: string
          center_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          receipt_date?: string
          receipt_no?: string
          remark?: string | null
          shipper_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_asn_id_fkey"
            columns: ["asn_id"]
            isOneToOne: true
            referencedRelation: "asns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_asn_id_fkey"
            columns: ["asn_id"]
            isOneToOne: true
            referencedRelation: "v_doc_trace"
            referencedColumns: ["asn_id"]
          },
          {
            foreignKeyName: "receipts_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts_hist: {
        Row: {
          asn_id: string
          center_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          receipt_date: string
          receipt_no: string
          remark: string | null
          shipper_id: string
          started_at: string
          status: string
          updated_at: string
          updated_by: string | null
          worker_id: string | null
        }
        Insert: {
          asn_id: string
          center_id: string
          completed_at?: string | null
          created_at: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          receipt_date: string
          receipt_no: string
          remark?: string | null
          shipper_id: string
          started_at: string
          status: string
          updated_at: string
          updated_by?: string | null
          worker_id?: string | null
        }
        Update: {
          asn_id?: string
          center_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          receipt_date?: string
          receipt_no?: string
          remark?: string | null
          shipper_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          worker_id?: string | null
        }
        Relationships: []
      }
      shippers: {
        Row: {
          address: string | null
          biz_no: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          manager_email: string | null
          manager_name: string | null
          manager_tel: string | null
          remark: string | null
          shipper_code: string
          shipper_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          biz_no?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          manager_email?: string | null
          manager_name?: string | null
          manager_tel?: string | null
          remark?: string | null
          shipper_code: string
          shipper_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          biz_no?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          manager_email?: string | null
          manager_name?: string | null
          manager_tel?: string | null
          remark?: string | null
          shipper_code?: string
          shipper_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      shippers_hist: {
        Row: {
          address: string | null
          biz_no: string | null
          created_at: string
          created_by: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          is_active: boolean
          manager_email: string | null
          manager_name: string | null
          manager_tel: string | null
          remark: string | null
          shipper_code: string
          shipper_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          biz_no?: string | null
          created_at: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          is_active: boolean
          manager_email?: string | null
          manager_name?: string | null
          manager_tel?: string | null
          remark?: string | null
          shipper_code: string
          shipper_name: string
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          biz_no?: string | null
          created_at?: string
          created_by?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          is_active?: boolean
          manager_email?: string | null
          manager_name?: string | null
          manager_tel?: string | null
          remark?: string | null
          shipper_code?: string
          shipper_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          created_by: string | null
          driver_name: string | null
          driver_tel: string | null
          id: string
          is_active: boolean
          remark: string | null
          shipper_id: string
          tonnage: number | null
          updated_at: string
          updated_by: string | null
          vehicle_no: string
          vehicle_type_code: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          driver_tel?: string | null
          id?: string
          is_active?: boolean
          remark?: string | null
          shipper_id: string
          tonnage?: number | null
          updated_at?: string
          updated_by?: string | null
          vehicle_no: string
          vehicle_type_code?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          driver_tel?: string | null
          id?: string
          is_active?: boolean
          remark?: string | null
          shipper_id?: string
          tonnage?: number | null
          updated_at?: string
          updated_by?: string | null
          vehicle_no?: string
          vehicle_type_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles_hist: {
        Row: {
          created_at: string
          created_by: string | null
          driver_name: string | null
          driver_tel: string | null
          hist_at: string
          hist_by: string | null
          hist_id: number
          hist_op: string
          id: string
          is_active: boolean
          remark: string | null
          shipper_id: string
          tonnage: number | null
          updated_at: string
          updated_by: string | null
          vehicle_no: string
          vehicle_type_code: string | null
        }
        Insert: {
          created_at: string
          created_by?: string | null
          driver_name?: string | null
          driver_tel?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op: string
          id: string
          is_active: boolean
          remark?: string | null
          shipper_id: string
          tonnage?: number | null
          updated_at: string
          updated_by?: string | null
          vehicle_no: string
          vehicle_type_code?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          driver_tel?: string | null
          hist_at?: string
          hist_by?: string | null
          hist_id?: never
          hist_op?: string
          id?: string
          is_active?: boolean
          remark?: string | null
          shipper_id?: string
          tonnage?: number | null
          updated_at?: string
          updated_by?: string | null
          vehicle_no?: string
          vehicle_type_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_doc_trace: {
        Row: {
          approved_qty: number | null
          asn_date: string | null
          asn_id: string | null
          asn_line_no: number | null
          asn_no: string | null
          asn_status: string | null
          diff_qty: number | null
          internal_code: string | null
          item_name: string | null
          loaded_qty: number | null
          loading_no: string | null
          loading_status: string | null
          order_qty: number | null
          plan_date: string | null
          plan_id: string | null
          plan_line_no: number | null
          plan_no: string | null
          plan_qty: number | null
          plan_status: string | null
          receipt_no: string | null
          receipt_status: string | null
          received_qty: number | null
          return_qty: number | null
          shipper_code: string | null
          shipper_item_code: string | null
          shipper_name: string | null
          vehicle_no: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_role: { Args: never; Returns: string }
      auth_shipper_id: { Args: never; Returns: string }
      auth_user_type: { Args: never; Returns: string }
      can_access_shipper: { Args: { p_shipper_id: string }; Returns: boolean }
      fn_allow_status_change: { Args: never; Returns: undefined }
      fn_enable_audit: { Args: { p_table: string }; Returns: undefined }
      fn_enable_history: { Args: { p_table: string }; Returns: undefined }
      fn_next_doc_no: {
        Args: { p_date?: string; p_prefix: string }
        Returns: string
      }
      fn_sync_plan_asn_qty: {
        Args: { p_plan_line_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_internal: { Args: never; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
