/**
 * Aircraft type ratings & endorsements.
 */
import { supabase } from "@/integrations/supabase/client";

export interface TypeRating {
  id: string;
  user_id: string;
  authority: string;
  aircraft_type: string;
  category: string;
  issue_date: string | null;
  expiry_date: string | null;
  certificate_no: string;
  practical_assessment_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type TypeRatingInput = Omit<TypeRating, "id" | "user_id" | "created_at" | "updated_at">;

export async function fetchTypeRatings(): Promise<TypeRating[]> {
  const { data, error } = await supabase
    .from("type_ratings")
    .select("*")
    .order("issue_date", { ascending: false, nullsFirst: false });
  if (error) { console.error(error); return []; }
  return (data ?? []) as unknown as TypeRating[];
}

export async function saveTypeRating(input: TypeRatingInput): Promise<TypeRating> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("type_ratings")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as TypeRating;
}

export async function updateTypeRating(id: string, input: Partial<TypeRatingInput>): Promise<void> {
  const { error } = await supabase.from("type_ratings").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteTypeRating(id: string): Promise<void> {
  const { error } = await supabase.from("type_ratings").delete().eq("id", id);
  if (error) throw error;
}
