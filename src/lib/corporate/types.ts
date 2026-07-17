// src/lib/corporate/types.ts
// Tipe untuk fitur Corporate Vault (Dokumen + Email Hub + Langganan).
// Mirror dari skema Supabase HRIS. Catatan: uploader/creator diarahkan ke
// tabel `members` (id = auth.uid), bukan `profiles`.

export type CategoryType = "file";

export interface MemberLite {
  id: string;
  name: string | null;
  email: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  type: CategoryType;
  color: string;
  icon: string | null;
  description: string | null;
  created_at: string;
}

export interface FileRow {
  id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  file_type: string;
  category_id: string | null;
  uploaded_by: string | null;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface FileWithRelations extends FileRow {
  category: Category | null;
  uploader: MemberLite | null;
}

// --- Dipakai di langkah berikutnya (Email Hub & Langganan) ---
export interface EmailAccount {
  id: string;
  email: string;
  password: string;
  label: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BillingCycle = "monthly" | "yearly" | "one_time";
export type SubStatus = "active" | "trial" | "cancelled";

export interface Subscription {
  id: string;
  platform: string;
  plan: string | null;
  price: number | null;
  currency: string;
  billing_cycle: BillingCycle;
  renewal_date: string | null;
  status: SubStatus;
  account_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
