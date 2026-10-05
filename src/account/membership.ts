import { getSupabaseClient } from "./client";

export type Membership = {
  plan: "free" | "plus" | "pro";
  status: "active" | "trialing" | "past_due" | "canceled" | "inactive";
};

/** Membership is server-managed. This client can only read its own record. */
export async function readMembership(userId: string): Promise<Membership> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Account services are not configured.");
  const { data, error } = await client
    .from("subscriptions")
    .select("user_id,plan,status")
    .eq("user_id", userId)
    .single();
  if (error || !data || data.user_id !== userId) {
    throw new Error("Your account membership could not be loaded.");
  }
  if (
    !["free", "plus", "pro"].includes(data.plan) ||
    !["active", "trialing", "past_due", "canceled", "inactive"].includes(data.status)
  ) {
    throw new Error("The account returned an invalid membership.");
  }
  return { plan: data.plan, status: data.status };
}
