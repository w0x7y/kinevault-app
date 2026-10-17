// Mirrors published KineVault exercise demonstrations into Track's Supabase
// project. Dry run by default; pass --apply to write. KineVault is read only
// with its publishable key, so the script sees what a published page sees.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

export const demoBucket = "exercise-demos";
// The app's demo frame uses the same color (src/exercise/demo/config.ts).
export const demoBackdrop = "#232f3b";
export const anatomyCredit =
  "Anatomy: Z-Anatomy (CC BY-SA 4.0); BodyParts3D © DBCLS (CC BY-SA 2.1 JP).";
const maxMediaBytes = 10 * 1024 * 1024;
const textLimit = 400;
const catalogColumns =
  "id,slug,name,aliases,muscle_group,equipment,status,video_path,poster_path,credit,published_at";
const comparedFields = [
  "slug",
  "name",
  "aliases",
  "muscle_group",
  "equipment",
  "status",
  "video_path",
  "poster_path",
  "credit",
  "published_at",
];

const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

export function demoCredit({ licenseName, sourceCredit }) {
  const credit = sourceCredit?.trim() ?? "";
  const license = licenseName?.trim() ?? "";
  const parts = ["Demonstration: KineVault."];
  if (credit) parts.push(sentence(credit));
  if (license) parts.push(`License: ${sentence(license)}`);
  // The source credit stands in for the anatomy notice only when it names both
  // anatomy sources.
  if (!(/z-anatomy/i.test(credit) && /bodyparts3d/i.test(credit))) parts.push(anatomyCredit);
  return parts.join(" ").slice(0, 1000);
}

function joinNames(names) {
  const unique = [
    ...new Set(
      names
        .filter(Boolean)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  let text = "";
  for (const name of unique.sort((a, b) => a.localeCompare(b))) {
    const next = text ? `${text}, ${name}` : name;
    if (next.length > textLimit) break;
    text = next;
  }
  return text;
}

function rootName(muscles, id) {
  let muscle = muscles.get(id);
  const seen = new Set();
  while (muscle?.parent_id && muscles.has(muscle.parent_id) && !seen.has(muscle.id)) {
    seen.add(muscle.id);
    muscle = muscles.get(muscle.parent_id);
  }
  return muscle?.name;
}

function newestReplacements(replacements) {
  const newest = new Map();
  const ordered = [...replacements].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  for (const item of ordered) {
    const key = `${item.storage_bucket}/${item.original_path}`;
    if (!newest.has(key)) newest.set(key, item);
  }
  return newest;
}

function chooseMediaGroup(media, scenes) {
  const groups = new Map();
  for (const item of media) {
    if (item.kind !== "mp4" && item.kind !== "poster") continue;
    const group = groups.get(item.asset_group_id) ?? {};
    group[item.kind] = item;
    groups.set(item.asset_group_id, group);
  }
  const score = ({ mp4 }) => [
    mp4.camera_angle && mp4.camera_angle === scenes.get(mp4.scene_id)?.default_camera_angle ? 1 : 0,
    mp4.character_presentation === "neutral" ? 1 : 0,
    Date.parse(mp4.created_at),
  ];
  const complete = [...groups.values()].filter((group) => group.mp4 && group.poster);
  complete.sort((a, b) => {
    const [left, right] = [score(a), score(b)];
    return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
  });
  return complete[0] ?? null;
}

function resolved(item, replacements) {
  const replacement = replacements.get(`${item.storage_bucket}/${item.storage_path}`);
  return {
    bucket: item.storage_bucket,
    path: replacement?.replacement_path ?? item.storage_path,
    licenseName: replacement?.license_name ?? item.license_name,
    sourceCredit: replacement?.source_credit ?? item.source_credit,
  };
}

export const publishedExerciseIds = (raw) =>
  new Set(
    raw.exercises
      .filter((exercise) => exercise.status === "published")
      .map((exercise) => exercise.id),
  );

export function buildSourceExercises(raw) {
  const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
  const contents = byId(raw.contents);
  const muscles = byId(raw.muscles);
  const equipment = byId(raw.equipment);
  const scenes = byId(raw.scenes);
  const replacements = newestReplacements(raw.replacements);
  const sources = [];
  const skipped = [];
  for (const exercise of raw.exercises) {
    if (exercise.status !== "published") continue;
    const content = contents.get(exercise.current_content_id);
    const name = content?.name?.trim();
    if (!name || name.length > textLimit) {
      skipped.push({ slug: exercise.slug, reason: "no usable current content" });
      continue;
    }
    const own = (rows) => rows.filter((row) => row.content_id === content.id);
    const group = chooseMediaGroup(own(raw.media), scenes);
    if (!group) {
      skipped.push({ slug: exercise.slug, reason: "no complete MP4 and poster" });
      continue;
    }
    const video = resolved(group.mp4, replacements);
    const poster = resolved(group.poster, replacements);
    const aliases = [...new Set(own(raw.aliases).map((row) => row.alias.trim()))]
      .filter((alias) => alias && alias.length <= textLimit)
      .filter((alias) => alias.toLowerCase() !== name.toLowerCase())
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 50);
    sources.push({
      id: exercise.id,
      slug: exercise.slug,
      name,
      aliases,
      muscleGroup: joinNames(
        own(raw.exerciseMuscles)
          .filter((row) => row.role === "primary")
          .map((row) => rootName(muscles, row.muscle_id)),
      ),
      equipment: joinNames(
        own(raw.exerciseEquipment)
          .filter((row) => row.role === "required")
          .map((row) => equipment.get(row.equipment_id)?.name),
      ),
      publishedAt: exercise.published_at ?? null,
      video: { bucket: video.bucket, path: video.path },
      poster: { bucket: poster.bucket, path: poster.path },
      credit: demoCredit(video),
    });
  }
  return { sources, skipped };
}

export function checkMedia(bytes, kind) {
  if (bytes.byteLength === 0 || bytes.byteLength > maxMediaBytes)
    throw new Error(`The ${kind} size is outside 1 byte to 10 MB.`);
  const ascii = (start, end) => Buffer.from(bytes.subarray(start, end)).toString("latin1");
  if (kind === "video" && ascii(4, 8) !== "ftyp") throw new Error("The video is not an MP4 file.");
  if (kind === "poster" && (ascii(0, 4) !== "RIFF" || ascii(8, 12) !== "WEBP"))
    throw new Error("The poster is not a WebP file.");
}

// KineVault records its 640×640 viewer page: an off-white #f6f8f8 background with an
// attribution strip and a menu button in the bottom 64 px. This cuts the strip, pads
// to the app's 4:3 frame and swaps the page color for the backdrop. Each row's credit
// carries the attribution.
// shortcut: assumes square renders laid out like today's; re-measure if KineVault changes its viewer.
const reframeFilter =
  "scale=640:640,crop=640:552:0:24,pad=736:552:48:0:0xf6f8f8,colorkey=0xf6f8f8:0.06:0.08," +
  `split[page][figure];[page]drawbox=c=0x${demoBackdrop.slice(1)}:t=fill:replace=1[backdrop];` +
  "[backdrop][figure]overlay,format=yuv420p";
const encoders = {
  video: ["-an", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-movflags", "+faststart"],
  poster: ["-c:v", "libwebp", "-quality", "85"],
};
const runFile = promisify(execFile);

export async function reframeDemo(bytes, kind) {
  const extension = kind === "video" ? "mp4" : "webp";
  const dir = await mkdtemp(join(tmpdir(), "track-demo-"));
  const input = join(dir, `in.${extension}`);
  const output = join(dir, `out.${extension}`);
  try {
    await writeFile(input, bytes);
    // One thread and bitexact output give the same bytes every run, so the
    // content-hash file names stay stable and dry runs don't re-upload.
    await runFile(process.env.FFMPEG_PATH || "ffmpeg", [
      ...["-v", "error", "-y", "-i", input, "-filter_complex", reframeFilter],
      ...["-threads", "1", "-fflags", "+bitexact", "-map_metadata", "-1"],
      ...encoders[kind],
      output,
    ]);
    return new Uint8Array(await readFile(output));
  } catch (error) {
    const hint = error?.code === "ENOENT" ? " Install ffmpeg or set FFMPEG_PATH." : "";
    throw new Error(`Couldn't reframe the ${kind}: ${error?.message ?? error}${hint}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function mediaPath(id, bytes, extension) {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return `${id}/${hash}.${extension}`;
}

// Track's slugs are unique across every row, withdrawn ones included, so a clash would fail the
// whole batch upsert with an opaque constraint error. Naming it first leaves nothing half written.
export function assertNoSlugConflicts(sources, current) {
  const holders = new Map(current.map((row) => [row.slug, row]));
  for (const source of sources) {
    const holder = holders.get(source.slug);
    if (holder && holder.id !== source.id)
      throw new Error(
        `The slug "${source.slug}" belongs to Track row ${holder.id}, but KineVault publishes it for exercise ${source.id}. Rename or remove one of them, then run again.`,
      );
  }
}

const comparable = (field, value) =>
  field === "published_at" && value ? Date.parse(value) : JSON.stringify(value ?? null);

// `publishedIds` lists every exercise KineVault still publishes, including ones
// skipped for missing media. Only rows outside it are withdrawn, so a skipped
// exercise keeps its current Track row.
export function planCatalogPublish({
  sources,
  current,
  now,
  publishedIds = new Set(sources.map((source) => source.id)),
}) {
  const currentById = new Map(current.map((row) => [row.id, row]));
  const inserts = [];
  const updates = [];
  for (const source of sources) {
    const row = {
      id: source.id,
      slug: source.slug,
      name: source.name,
      aliases: source.aliases,
      muscle_group: source.muscleGroup,
      equipment: source.equipment,
      status: "published",
      video_path: source.videoPath,
      poster_path: source.posterPath,
      credit: source.credit,
      published_at: source.publishedAt,
    };
    const existing = currentById.get(source.id);
    if (!existing) {
      inserts.push({ ...row, updated_at: now });
    } else if (
      comparedFields.some(
        (field) => comparable(field, existing[field]) !== comparable(field, row[field]),
      )
    ) {
      updates.push({ ...row, updated_at: now });
    }
  }
  const withdrawals = current
    .filter((row) => row.status === "published" && !publishedIds.has(row.id))
    .map((row) => ({ id: row.id, slug: row.slug }));
  return { inserts, updates, withdrawals };
}

export function describePlan({ plan, uploads, skipped, apply }) {
  const lines = [
    `${apply ? "Publishing:" : "Dry run:"} ${plan.inserts.length} rows to insert, ${plan.updates.length} to update, ${plan.withdrawals.length} to withdraw, ${uploads.length} files to upload.`,
  ];
  for (const row of plan.inserts) lines.push(`  insert ${row.slug}`);
  for (const row of plan.updates) lines.push(`  update ${row.slug}`);
  for (const row of plan.withdrawals) lines.push(`  withdraw ${row.slug}`);
  for (const file of uploads) lines.push(`  upload ${file.path} (${file.bytes.byteLength} bytes)`);
  for (const item of skipped) lines.push(`  skip ${item.slug}: ${item.reason}`);
  if (!apply) lines.push("Nothing was written. Run again with --apply to publish.");
  return lines.join("\n");
}

export async function publishCatalog({
  kinevault,
  track,
  apply = false,
  now = () => new Date().toISOString(),
  log = console.log,
  reframe = reframeDemo,
}) {
  const raw = await kinevault.readRaw();
  const { sources, skipped } = buildSourceExercises(raw);
  const publishedIds = publishedExerciseIds(raw);
  const current = await track.readRows();
  // An empty read usually means KineVault's stack is down or unseeded, not that
  // every demo was retired.
  if (publishedIds.size === 0 && current.some((row) => row.status === "published"))
    throw new Error(
      "KineVault reports no published exercises; refusing to withdraw every Track demo. Check that KineVault's local stack is running with its data.",
    );
  assertNoSlugConflicts(sources, current);
  const located = [];
  const files = [];
  // A download or format failure stops the run before anything is written, so
  // a temporary problem can't withdraw a demo.
  for (const source of sources) {
    const rawVideo = await kinevault.download(source.video);
    const rawPoster = await kinevault.download(source.poster);
    checkMedia(rawVideo, "video");
    checkMedia(rawPoster, "poster");
    const video = await reframe(rawVideo, "video");
    const poster = await reframe(rawPoster, "poster");
    const videoPath = mediaPath(source.id, video, "mp4");
    const posterPath = mediaPath(source.id, poster, "webp");
    located.push({ ...source, videoPath, posterPath });
    files.push(
      { path: videoPath, bytes: video, contentType: "video/mp4" },
      { path: posterPath, bytes: poster, contentType: "image/webp" },
    );
  }
  const existing = await track.listObjects(located.map((source) => source.id));
  const uploads = files.filter((file) => !existing.has(file.path));
  const plan = planCatalogPublish({ sources: located, current, now: now(), publishedIds });
  log(describePlan({ plan, uploads, skipped, apply }));
  if (apply) {
    // Files first, so a written row never points at a missing object.
    for (const file of uploads) await track.upload(file);
    const rows = [...plan.inserts, ...plan.updates];
    if (rows.length) await track.upsertRows(rows);
    if (plan.withdrawals.length)
      await track.withdraw(
        plan.withdrawals.map((row) => row.id),
        now(),
      );
  }
  return { plan, uploads, skipped };
}

const pageSize = 1000;
// A server that ignores `range` would return rows forever, so reads give up after this many pages.
const maxPages = 1000;
// The server may cap a page below `pageSize`, so the next page starts after the rows actually
// returned and only an empty page ends the read.
export async function readAll(build, label) {
  const rows = [];
  let from = 0;
  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw new Error(`Couldn't read ${label}: ${error.message}`);
    if (data.length === 0) return rows;
    rows.push(...data);
    from += data.length;
  }
  throw new Error(
    `Couldn't read ${label}: the server still returned rows after ${maxPages.toLocaleString("en-US")} pages. It may be ignoring range requests.`,
  );
}
// Offset paging needs a total order, so every read sorts by a unique key.
const sortBy = (query, order) => order.reduce((sorted, column) => sorted.order(column), query);
// Short chunks keep the filter inside the request-line limit of the API gateway.
const chunkSize = 50;
async function readIn(client, table, columns, column, values, order) {
  const unique = [...new Set(values)];
  const rows = [];
  for (let start = 0; start < unique.length; start += chunkSize) {
    const part = unique.slice(start, start + chunkSize);
    rows.push(
      ...(await readAll(
        () => sortBy(client.from(table).select(columns).in(column, part), order),
        table,
      )),
    );
  }
  return rows;
}
const serverClient = (url, key) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

export function kinevaultPort(url, key) {
  const client = serverClient(url, key);
  return {
    async readRaw() {
      const exercises = await readAll(
        () =>
          client
            .from("exercises")
            .select("id,slug,status,current_content_id,published_at")
            .eq("status", "published")
            .order("id"),
        "exercises",
      );
      const ids = exercises.map((row) => row.current_content_id).filter(Boolean);
      const [
        contents,
        aliases,
        exerciseMuscles,
        exerciseEquipment,
        scenes,
        media,
        muscles,
        equipment,
      ] = await Promise.all([
        readIn(client, "exercise_content", "id,name", "id", ids, ["id"]),
        readIn(client, "exercise_aliases", "content_id,alias", "content_id", ids, [
          "content_id",
          "normalized_alias",
        ]),
        readIn(client, "exercise_muscles", "content_id,muscle_id,role", "content_id", ids, [
          "content_id",
          "muscle_id",
        ]),
        readIn(client, "exercise_equipment", "content_id,equipment_id,role", "content_id", ids, [
          "content_id",
          "equipment_id",
        ]),
        readIn(client, "exercise_scenes", "id,content_id,default_camera_angle", "content_id", ids, [
          "id",
        ]),
        readIn(
          client,
          "exercise_media",
          "content_id,scene_id,asset_group_id,kind,storage_bucket,storage_path,camera_angle,character_presentation,license_name,source_credit,created_at",
          "content_id",
          ids,
          ["id"],
        ),
        readAll(() => client.from("muscles").select("id,name,parent_id").order("id"), "muscles"),
        readAll(() => client.from("equipment").select("id,name").order("id"), "equipment"),
      ]);
      const replacements = await readIn(
        client,
        "media_render_replacements",
        "storage_bucket,original_path,replacement_path,license_name,source_credit,created_at",
        "original_path",
        media.map((row) => row.storage_path),
        ["storage_bucket", "original_path", "renderer_version"],
      );
      return {
        exercises,
        contents,
        aliases,
        exerciseMuscles,
        exerciseEquipment,
        scenes,
        media,
        muscles,
        equipment,
        replacements,
      };
    },
    async download({ bucket, path }) {
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error) throw new Error(`Couldn't download ${bucket}/${path}: ${error.message}`);
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}

export function trackPort(url, serviceKey) {
  const client = serverClient(url, serviceKey);
  return {
    readRows: () =>
      readAll(
        () => client.from("catalog_exercises").select(catalogColumns).order("id"),
        "catalog_exercises",
      ),
    async listObjects(ids) {
      const paths = new Set();
      for (const id of ids) {
        const { data, error } = await client.storage.from(demoBucket).list(id, { limit: 1000 });
        if (error) throw new Error(`Couldn't list ${demoBucket}/${id}: ${error.message}`);
        for (const object of data) paths.add(`${id}/${object.name}`);
      }
      return paths;
    },
    async upload({ path, bytes, contentType }) {
      const { error } = await client.storage
        .from(demoBucket)
        .upload(path, bytes, { contentType, cacheControl: "31536000", upsert: false });
      if (error) throw new Error(`Couldn't upload ${path}: ${error.message}`);
    },
    async upsertRows(rows) {
      const { error } = await client.from("catalog_exercises").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`Couldn't write catalog rows: ${error.message}`);
    },
    async withdraw(ids, at) {
      const { error } = await client
        .from("catalog_exercises")
        .update({ status: "withdrawn", updated_at: at })
        .in("id", ids);
      if (error) throw new Error(`Couldn't withdraw catalog rows: ${error.message}`);
    },
  };
}

const requiredEnvironment = [
  "KINEVAULT_SUPABASE_URL",
  "KINEVAULT_SUPABASE_PUBLISHABLE_KEY",
  "TRACK_SUPABASE_URL",
  "TRACK_SUPABASE_SERVICE_ROLE_KEY",
];
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  const missing = requiredEnvironment.filter((name) => !env[name]?.trim());
  if (missing.length) {
    console.error(`Set ${missing.join(", ")}. See docs/exercise-demos.md.`);
    process.exitCode = 1;
  } else {
    // Keys are never logged.
    publishCatalog({
      kinevault: kinevaultPort(env.KINEVAULT_SUPABASE_URL, env.KINEVAULT_SUPABASE_PUBLISHABLE_KEY),
      track: trackPort(env.TRACK_SUPABASE_URL, env.TRACK_SUPABASE_SERVICE_ROLE_KEY),
      apply: process.argv.slice(2).includes("--apply"),
    }).catch((error) => {
      console.error(error instanceof Error ? error.message : "Publishing failed.");
      process.exitCode = 1;
    });
  }
}
