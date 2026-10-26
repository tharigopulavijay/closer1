export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          verified: boolean;
          intent: string;
        };
        Insert: { id: string; display_name: string };
        Update: { display_name?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_my_drop: { Args: Record<string, never>; Returns: string[] };
      record_drop_open: { Args: Record<string, never>; Returns: number };
      create_plan: { Args: { person_id: string; venue_id: string; slot: string }; Returns: string };
      send_message: { Args: { plan_id: string; body: string }; Returns: string };
      sos_trigger: { Args: { session_id: string; lat: number; lng: number }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
