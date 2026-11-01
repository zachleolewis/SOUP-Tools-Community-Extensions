#!/usr/bin/env node
// Validates extensions.json. See README.md for the rules.
//
//   npm run validate                 file checks + remote checks of new/changed entries (set GITHUB_TOKEN to avoid rate limits)
//   npm run validate -- --offline    file checks only, no network
//   --base <file>                    the list before this change (a pull request's base); only entries that differ are checked remotely
//   env PR_AUTHOR + IS_PULL_REQUEST  turn on the pull request rules (one entry per pull request, removals only by the owner)
import { readFileSync, existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const MAINTAINER = "zachleolewis";
// Ids SOUP's built-in modules use (the manifest rules: "not the id of a built-in module"). Extend as modules are added.
// The ids of SOUP's built-in modules (SoupScrimTracker `app/src-tauri/src/modules/`); SOUP refuses a manifest that uses one.
export const RESERVED_IDS = ["core", "riot-client", "replay-parser", "library", "extensions", "match-capture", "custom-games", "share", "view-in-client", "asset-patches", "replay-viewer-3d"];
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ID_RULE = "1 to 40 lowercase letters, digits and dashes, no leading or trailing dash, not starting with 'soup'";

// ---- A small JSON Schema checker for the subset the schema uses (type, required, properties, additionalProperties,
// pattern, minLength, maxLength, items). No dependencies.
export function checkSchema(value, schema, path = "$") {
  const errors = [];
  const t = schema.type;
  const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (t && actual !== t) return [`${path}: must be ${t === "array" ? "an array" : "a " + t}, got ${actual}`];
  if (t === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: must not be empty`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: is ${value.length} characters, the limit is ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: "${value}" does not match ${schema.description ?? schema.pattern}`);
  } else if (t === "array") {
    value.forEach((v, i) => errors.push(...checkSchema(v, schema.items ?? {}, `${path}[${i}]`)));
  } else if (t === "object") {
    for (const k of schema.required ?? []) if (!(k in value)) errors.push(`${path}: missing "${k}"`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k]) errors.push(...checkSchema(v, schema.properties[k], `${path}.${k}`));
      else if (schema.additionalProperties === false) errors.push(`${path}: unknown property "${k}"`);
    }
  }
  return errors;
}

const label = (e, i) => `entry ${i + 1}${e && typeof e.id === "string" ? ` (${e.id})` : ""}`;
const owner = (repo) => String(repo).split("/")[0].toLowerCase();
const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(o) { return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1))); }

// ---- Checks that need only the file.
export function checkFile(entries, schema) {
  const errors = [];
  const schemaErrors = checkSchema(entries, schema);
  errors.push(...schemaErrors);
  if (!Array.isArray(entries)) return errors;
  const ids = new Map(), repos = new Map();
  entries.forEach((e, i) => {
    if (!e || typeof e !== "object") return;
    if (typeof e.id === "string") {
      if (RESERVED_IDS.includes(e.id)) errors.push(`${label(e, i)}: id "${e.id}" is the id of a built-in SOUP module`);
      const k = e.id.toLowerCase();
      if (ids.has(k)) errors.push(`${label(e, i)}: duplicate id "${e.id}" (also entry ${ids.get(k) + 1})`);
      else ids.set(k, i);
    }
    if (typeof e.repo === "string") {
      const k = e.repo.toLowerCase();
      if (repos.has(k)) errors.push(`${label(e, i)}: duplicate repo "${e.repo}" (also entry ${repos.get(k) + 1})`);
      else repos.set(k, i);
      if (e.official === true && owner(e.repo) !== MAINTAINER)
        errors.push(`${label(e, i)}: "official": true is only for repositories owned by ${MAINTAINER}, not "${owner(e.repo)}"`);
    }
  });
  return errors;
}

// ---- Compare with the base list: which entries are new/changed, which were removed.
export function diffEntries(base, entries) {
  const byId = new Map(base.map((e) => [e.id.toLowerCase(), e]));
  const now = new Set(entries.map((e) => e.id.toLowerCase()));
  const added = [], changed = [];
  for (const e of entries) {
    const old = byId.get(e.id.toLowerCase());
    if (!old) added.push(e);
    else if (!same(old, e)) changed.push(e);
  }
  const removed = base.filter((e) => !now.has(e.id.toLowerCase()));
  return { added, changed, removed };
}

export function checkPullRequest({ added, changed, removed }, prAuthor) {
  const errors = [];
  const touched = added.length + changed.length;
  if (touched > 1)
    errors.push(`this pull request adds or changes ${touched} entries (${[...added, ...changed].map((e) => e.id).join(", ")}); one entry per pull request`);
  for (const e of removed) {
    const a = String(prAuthor || "").toLowerCase();
    if (!a) errors.push(`entry "${e.id}" was removed, and the pull request author is unknown; only the repository owner or ${MAINTAINER} can remove an entry`);
    else if (a !== owner(e.repo) && a !== MAINTAINER)
      errors.push(`entry "${e.id}" was removed by ${prAuthor}; only its owner (${owner(e.repo)}) or ${MAINTAINER} can remove an entry`);
  }
  return errors;
}

// ---- Remote checks (GitHub API).
async function getJson(fetchFn, url, headers) {
  const res = await fetchFn(url, { headers });
  if (!res.ok) return { status: res.status, body: null };
  return { status: res.status, body: await res.json() };
}

// Reads manifest.json out of a zip (stored or deflated entries); no dependency.
export function readZipEntry(buf, wanted) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("broken zip directory");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    if (name === wanted) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + csize);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`unsupported zip compression ${method}`);
    }
    p += 46 + nlen + elen + clen;
  }
  return null;
}

export async function checkRemote(entry, { fetch: fetchFn, token }) {
  const errors = [], notes = [];
  const who = `${entry.id} (${entry.repo})`;
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "soup-tools-community-validate" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const api = `https://api.github.com/repos/${entry.repo}`;

  let repo;
  try { repo = await getJson(fetchFn, api, headers); } catch (e) { return { errors: [`${who}: could not reach GitHub (${e.message})`], notes }; }
  if (repo.status === 404) return { errors: [`${who}: repository not found or not public`], notes };
  if (!repo.body) return { errors: [`${who}: GitHub answered ${repo.status} for the repository`], notes };
  if (repo.body.private) errors.push(`${who}: the repository is private; it must be public`);
  if (repo.body.archived) notes.push(`${who}: the repository is archived`);
  const lic = repo.body.license?.spdx_id;
  if (!lic || lic === "NOASSERTION") notes.push(`${who}: GitHub does not detect an OSI license; the reviewer will check the license by hand`);
  if (errors.length) return { errors, notes };

  const rel = await getJson(fetchFn, `${api}/releases/latest`, headers);
  if (rel.status === 404) return { errors: [`${who}: no published release found; publish a GitHub release first (not a draft or pre-release)`], notes };
  if (!rel.body) return { errors: [`${who}: GitHub answered ${rel.status} for the latest release`], notes };
  const assets = new Map((rel.body.assets ?? []).map((a) => [a.name, a]));
  const hasLoose = assets.has("manifest.json") && assets.has("main.js");
  const hasZip = assets.has("extension.zip");
  if (!hasLoose && !hasZip) {
    const have = [...assets.keys()].join(", ") || "no files";
    return { errors: [`${who}: the latest release (${rel.body.tag_name}) needs manifest.json and main.js, or extension.zip; it has ${have}`], notes };
  }

  let manifest;
  try {
    if (assets.has("manifest.json")) {
      const r = await fetchFn(assets.get("manifest.json").browser_download_url, { headers: { "User-Agent": headers["User-Agent"] } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      manifest = JSON.parse(await r.text());
    } else {
      const r = await fetchFn(assets.get("extension.zip").browser_download_url, { headers: { "User-Agent": headers["User-Agent"] } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const file = readZipEntry(Buffer.from(await r.arrayBuffer()), "manifest.json");
      if (!file) return { errors: [`${who}: extension.zip has no manifest.json at its top level`], notes };
      manifest = JSON.parse(file.toString("utf8"));
    }
  } catch (e) {
    return { errors: [`${who}: could not read the release manifest (${e.message})`], notes };
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return { errors: [`${who}: manifest.json is not a JSON object`], notes };

  if (manifest.id !== entry.id) errors.push(`${who}: manifest id "${manifest.id}" must equal the entry id "${entry.id}"`);
  if (manifest.name !== entry.name) errors.push(`${who}: manifest name "${manifest.name}" must equal the entry name "${entry.name}"`);
  if (typeof manifest.version !== "string" || !SEMVER.test(manifest.version)) errors.push(`${who}: manifest version "${manifest.version}" is not a semver version like 1.2.0`);
  for (const f of ["minAppVersion", "apiVersion"])
    if (typeof manifest[f] !== "string" || !manifest[f].trim()) errors.push(`${who}: manifest is missing "${f}"`);
  if (typeof manifest.version === "string") {
    const tag = String(rel.body.tag_name ?? "");
    if (tag !== manifest.version && tag !== "v" + manifest.version)
      errors.push(`${who}: release tag "${tag}" must equal the manifest version "${manifest.version}" (or v${manifest.version})`);
  }
  if (manifest.author !== entry.author) notes.push(`${who}: manifest author "${manifest.author}" differs from the entry author "${entry.author}"`);
  if (manifest.uses === undefined) notes.push(`${who}: manifest has no "uses"; the reviewer will check what the extension does`);
  return { errors, notes };
}

// ---- Everything together. Returns { errors, notes, checked }.
export async function validate({ entries, base, schema, offline = false, isPullRequest = false, prAuthor = "", fetch: fetchFn = globalThis.fetch, token = "" }) {
  const errors = checkFile(entries, schema);
  const notes = [];
  const checked = [];
  if (errors.length || !Array.isArray(entries)) return { errors, notes, checked };

  let toCheck = entries;
  if (base) {
    const d = diffEntries(base, entries);
    toCheck = [...d.added, ...d.changed];
    if (isPullRequest) errors.push(...checkPullRequest(d, prAuthor));
    notes.push(`compared with the base list: ${d.added.length} added, ${d.changed.length} changed, ${d.removed.length} removed`);
  } else if (isPullRequest) {
    notes.push("no base list given; the one-entry rule could not be checked");
  }
  if (offline) {
    notes.push("offline: repositories and releases were not checked");
    return { errors, notes, checked };
  }
  for (const e of toCheck) {
    const r = await checkRemote(e, { fetch: fetchFn, token });
    errors.push(...r.errors);
    notes.push(...r.notes);
    checked.push(e.id);
  }
  return { errors, notes, checked };
}

// ---- Command line.
async function main() {
  const args = process.argv.slice(2);
  const offline = args.includes("--offline");
  const bi = args.indexOf("--base");
  const baseFile = bi >= 0 ? args[bi + 1] : process.env.BASE_FILE;
  const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));
  const schema = readJson(join(ROOT, "schema", "extensions.schema.json"));
  let entries;
  try { entries = readJson(join(ROOT, "extensions.json")); }
  catch (e) { console.error(`extensions.json is not valid JSON: ${e.message}`); process.exit(1); }
  let base = null;
  if (baseFile && existsSync(baseFile)) {
    try { base = readJson(baseFile); if (!Array.isArray(base)) base = null; } catch { base = null; }
  }
  const { errors, notes, checked } = await validate({
    entries, base, schema, offline,
    isPullRequest: process.env.IS_PULL_REQUEST === "true",
    prAuthor: process.env.PR_AUTHOR ?? "",
    token: process.env.GITHUB_TOKEN ?? "",
  });
  console.log(`extensions.json: ${Array.isArray(entries) ? entries.length : "?"} entries; checked on GitHub: ${checked.length ? checked.join(", ") : "none"}`);
  for (const n of notes) console.log(`  note: ${n}`);
  if (errors.length) {
    console.error(`\n${errors.length} problem${errors.length > 1 ? "s" : ""}:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("OK");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
