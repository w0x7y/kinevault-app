import { getSupabaseClient } from "./client";
import type { AccountRemote, CloudDocument } from "./storage";

function documentFromRow(value: unknown, userId: string): CloudDocument {
  if (typeof value !== "object" || value === null) {
    throw new Error("The account returned an invalid tracking document.");
  }
  const row = value as Record<string, unknown>;
  if (
    row.user_id !== userId ||
    typeof row.document_key !== "string" ||
    (row.payload !== null && typeof row.payload !== "string") ||
    typeof row.revision !== "number" ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    typeof row.updated_at !== "string"
  ) {
    throw new Error("The account returned an invalid tracking document.");
  }
  return {
    document_key: row.document_key,
    payload: row.payload,
    revision: row.revision,
    updated_at: row.updated_at,
  };
}

/** Bind an adapter to one account for its entire lifetime, including retries. */
export function createAccountRemote(userId: string): AccountRemote {
  if (!userId) throw new Error("An account is required to sync tracking.");
  const client = getSupabaseClient();
  if (!client) throw new Error("Account services are not configured.");

  return {
    async list() {
      const { data, error } = await client
        .from("track_documents")
        .select("user_id,document_key,payload,revision,updated_at")
        .eq("user_id", userId);
      if (error) throw new Error("Your account tracking could not be loaded.");
      return (data ?? []).map((row) => documentFromRow(row, userId));
    },
    async save(key, payload, expectedRevision) {
      const { data, error } = await client.rpc("save_track_document", {
        p_user_id: userId,
        p_document_key: key,
        p_payload: payload,
        p_expected_revision: expectedRevision,
      });
      if (error) throw new Error("Your account tracking could not be saved.");
      if (!Array.isArray(data)) {
        throw new Error("The account returned an invalid save result.");
      }
      if (data.length === 0) return null;
      if (data.length !== 1) {
        throw new Error("The account returned an invalid save result.");
      }
      return documentFromRow(data[0], userId);
    },
  };
}
