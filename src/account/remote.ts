import { getSupabaseClient } from "./client";
import type { AccountRemote, CloudDocument } from "./storage";
import { createPartitionedRemote, type PartitionRow } from "./partitioned-remote";

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

  const legacy: AccountRemote = {
    async list(excludeKeys = []) {
      let query = client
        .from("track_documents")
        .select("user_id,document_key,payload,revision,updated_at")
        .eq("user_id", userId);
      // Migrated histories remain frozen recovery copies. Avoid downloading
      // those entire histories again during every incremental sync.
      if (excludeKeys.length) query = query.not("document_key", "in", `(${excludeKeys.join(",")})`);
      const { data, error } = await query;
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
  // Apply the reviewed SQL migration before activating this build setting.
  if (process.env.EXPO_PUBLIC_TRACK_PARTITIONS !== "true") return legacy;
  return createPartitionedRemote(legacy, {
    async list(known) {
      const { data, error } = await client.rpc("list_track_partitioned_documents", {
        p_user_id: userId,
        p_known_revisions: known,
      });
      if (error || !Array.isArray(data))
        throw new Error("Your account history could not be loaded.");
      return data.map((value: unknown) => {
        if (
          !value ||
          typeof value !== "object" ||
          !("user_id" in value) ||
          value.user_id !== userId
        )
          throw new Error("Invalid account history owner");
        const row = value as Record<string, unknown>;
        if (
          typeof row.document_key !== "string" ||
          typeof row.part_key !== "string" ||
          typeof row.payload !== "string" ||
          typeof row.revision !== "number" ||
          typeof row.updated_at !== "string"
        )
          throw new Error("Invalid account history row");
        return {
          document_key: row.document_key,
          part_key: row.part_key,
          payload: row.payload,
          revision: row.revision,
          updated_at: row.updated_at,
        } satisfies PartitionRow;
      });
    },
    async save(input) {
      const { data, error } = await client.rpc("save_track_partitioned_document", {
        p_user_id: userId,
        p_document_key: input.key,
        p_expected_revision: input.expectedRevision,
        p_deleted: input.deleted,
        p_parts: input.parts,
        p_changes: input.changes,
      });
      if (error) throw new Error("Your account history could not be saved.");
      if (data === null) return null;
      if (
        !data ||
        typeof data !== "object" ||
        typeof data.revision !== "number" ||
        typeof data.updated_at !== "string"
      )
        throw new Error("Invalid history save result");
      return { revision: data.revision, updated_at: data.updated_at };
    },
  });
}
