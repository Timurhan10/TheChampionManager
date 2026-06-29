import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType =
  | "transfer_offer"
  | "transfer_result"
  | "scout_complete"
  | "youth_intake"
  | "season_end"
  | "match_soon"
  | "cmp_purchase";

// Service client ile bildirim oluşturur (RLS bypass).
export async function notify(
  svc: SupabaseClient,
  userId: string,
  type: NotificationType,
  title: string,
  body?: string
) {
  await svc.from("notifications").insert({ user_id: userId, type, title, body: body ?? null });
}
