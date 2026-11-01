import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { validate, readZipEntry } from "../scripts/validate.mjs";

const schema = JSON.parse(readFileSync(new URL("../schema/extensions.schema.json", import.meta.url), "utf8"));
const entry = (o = {}) => ({ id: "heatmap", name: "Heatmap", author: "Someone", description: "Kill heatmaps.", repo: "someone/heatmap", ...o });
const manifest = (o = {}) => ({ id: "heatmap", name: "Heatmap", version: "1.0.0", minAppVersion: "2.3.0", apiVersion: "^1.0", author: "Someone", uses: [], ...o });

// A stubbed GitHub: { "owner/name": { private?, release?: { tag, assets: { fileName: body } } } }
function stub(repos) {
  return async (url) => {
    const res = (status, body, raw) => ({
      ok: status < 400,
      status,
      json: async () => body,
      text: async () => (typeof raw === "string" ? raw : JSON.stringify(body)),
      arrayBuffer: async () => raw,
    });
    let m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)(\/releases\/latest)?$/);
    if (m) {
      const r = repos[m[1].toLowerCase()];
      if (!r) return res(404, {});
      if (!m[2]) return res(200, { private: !!r.private, license: { spdx_id: "MIT" } });
      if (!r.release) return res(404, {});
      return res(200, {
        tag_name: r.release.tag,
        assets: Object.keys(r.release.assets).map((n) => ({ name: n, browser_download_url: `https://dl/${m[1]}/${n}` })),
      });
    }
    m = url.match(/^https:\/\/dl\/([^/]+\/[^/]+)\/(.+)$/);
    if (m) {
      const body = repos[m[1].toLowerCase()].release.assets[m[2]];
      if (Buffer.isBuffer(body)) return res(200, null, body);
      return res(200, null, typeof body === "string" ? body : JSON.stringify(body));
    }
    return res(404, {});
  };
}
const okRepo = (mf = manifest(), tag = "v1.0.0") => ({ release: { tag, assets: { "manifest.json": mf, "main.js": "x" } } });
const run = (entries, repos = {}, o = {}) => validate({ entries, schema, fetch: stub(repos), ...o });
const has = (r, text) => assert.ok(r.errors.some((e) => e.includes(text)), `expected "${text}" in:\n${r.errors.join("\n")}`);

function makeZip(bodyBytes, method) {
  const name = Buffer.from("manifest.json");
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(method, 8);
  lh.writeUInt16LE(name.length, 26);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(method, 10);
  cd.writeUInt32LE(bodyBytes.length, 20);
  cd.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(cd.length + name.length, 12);
  end.writeUInt32LE(lh.length + name.length + bodyBytes.length, 16);
  return Buffer.concat([lh, name, bodyBytes, cd, name, end]);
}

test("an empty list is valid", async () => {
  assert.deepEqual((await run([])).errors, []);
});

test("a valid entry passes", async () => {
  const r = await run([entry()], { "someone/heatmap": okRepo() });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.checked, ["heatmap"]);
});

test("a valid entry released as extension.zip only passes", async () => {
  const zip = makeZip(Buffer.from(JSON.stringify(manifest())), 0);
  const r = await run([entry()], { "someone/heatmap": { release: { tag: "1.0.0", assets: { "extension.zip": zip } } } });
  assert.deepEqual(r.errors, []);
});

test("deflated zip entries are read", () => {
  const zip = makeZip(deflateRawSync(Buffer.from("hello hello hello")), 8);
  assert.equal(readZipEntry(zip, "manifest.json").toString(), "hello hello hello");
});

test("duplicate id (case-insensitive) and duplicate repo", async () => {
  has(await run([entry(), entry({ id: "heatmap", repo: "other/x" })], {}, { offline: true }), "duplicate id");
  has(await run([entry(), entry({ id: "other", repo: "Someone/Heatmap" })], {}, { offline: true }), "duplicate repo");
});

test("bad ids", async () => {
  for (const id of ["My Ext", "-a", "a-", "soup-thing", "a".repeat(41), "UPPER", ""]) {
    has(await run([entry({ id })], {}, { offline: true }), "id");
  }
  has(await run([entry({ id: "library" })], {}, { offline: true }), "built-in");
});

test("schema: extra property, long description, missing field, bad repo", async () => {
  has(await run([entry({ extra: 1 })], {}, { offline: true }), 'unknown property "extra"');
  has(await run([entry({ description: "x".repeat(251) })], {}, { offline: true }), "limit is 250");
  const e = entry();
  delete e.author;
  has(await run([e], {}, { offline: true }), 'missing "author"');
  has(await run([entry({ repo: "not-a-repo" })], {}, { offline: true }), "repo");
});

test("official by another owner", async () => {
  has(await run([entry({ official: true })], {}, { offline: true }), "only for repositories owned by zachleolewis");
  const ok = await run([entry({ official: true, repo: "zachleolewis/heatmap" })], { "zachleolewis/heatmap": okRepo() });
  assert.deepEqual(ok.errors, []);
});

test("two entries in one pull request", async () => {
  const entries = [entry(), entry({ id: "other", name: "Other", repo: "someone/other" })];
  const repos = { "someone/heatmap": okRepo(), "someone/other": okRepo(manifest({ id: "other", name: "Other" })) };
  has(await run(entries, repos, { base: [], isPullRequest: true, prAuthor: "someone" }), "one entry per pull request");
});

test("only new or changed entries are checked remotely", async () => {
  const old = entry({ id: "old", name: "Old", repo: "x/old" });
  const r = await run([old, entry()], { "someone/heatmap": okRepo() }, { base: [old], isPullRequest: true, prAuthor: "someone" });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.checked, ["heatmap"]);
});

test("removal only by the owner or the maintainer", async () => {
  const base = [entry()];
  has(await run([], {}, { base, isPullRequest: true, prAuthor: "stranger" }), "can remove");
  assert.deepEqual((await run([], {}, { base, isPullRequest: true, prAuthor: "Someone" })).errors, []);
  assert.deepEqual((await run([], {}, { base, isPullRequest: true, prAuthor: "zachleolewis" })).errors, []);
});

test("missing release asset", async () => {
  const r = await run([entry()], { "someone/heatmap": { release: { tag: "v1.0.0", assets: { "main.js": "x" } } } });
  has(r, "needs manifest.json and main.js, or extension.zip");
});

test("no release, missing repo, private repo", async () => {
  has(await run([entry()], { "someone/heatmap": {} }), "no published release");
  has(await run([entry()], {}), "not found or not public");
  has(await run([entry()], { "someone/heatmap": { private: true, ...okRepo() } }), "private");
});

test("id and name mismatch, bad manifest fields, tag mismatch", async () => {
  const r = (mf, tag) => run([entry()], { "someone/heatmap": okRepo(mf, tag) });
  has(await r(manifest({ id: "other" })), 'manifest id "other"');
  has(await r(manifest({ name: "Nope" })), "manifest name");
  has(await r(manifest({ version: "1.0" })), "semver");
  has(await r(manifest({ minAppVersion: undefined })), "minAppVersion");
  has(await r(manifest({ apiVersion: undefined })), "apiVersion");
  has(await r(manifest(), "v2.0.0"), "release tag");
});

test("offline checks the file only", async () => {
  let called = false;
  const r = await validate({ entries: [entry()], schema, offline: true, fetch: async () => { called = true; } });
  assert.deepEqual(r.errors, []);
  assert.equal(called, false);
});
