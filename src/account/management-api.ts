import { getSupabaseClient } from "./client";

/** A null password asks the function to accept this session's recent Google sign-in instead. */
export async function deleteAccountOnServer(
  ownerId: string,
  password: string | null,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Account services are unavailable.");
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();
  if (sessionError || session?.user.id !== ownerId)
    throw new Error("The account changed. Start again.");
  const { data, error } = await client.functions.invoke("delete-account", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: password === null ? { confirmation: "DELETE" } : { password, confirmation: "DELETE" },
  });
  if (error || !data || data.deleted !== true)
    throw new Error(
      password === null
        ? "Couldn't confirm account deletion. Check your connection, sign in with Google again and delete within 10 minutes. Your local data has been kept."
        : "Couldn't confirm account deletion. Check your connection and password, then try again. Your local data has been kept.",
    );
}
