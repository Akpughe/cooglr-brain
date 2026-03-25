export interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  connection_id: string | null;
  query_text: string;
  created_at: string;
}
