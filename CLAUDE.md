# SOUP-Tools-Community-Extensions - notes for maintainers and agents

The approved list of community extensions. SOUP's Settings > Extensions > Browse downloads `extensions.json` from
`https://raw.githubusercontent.com/zachleolewis/SOUP-Tools-Community-Extensions/main/extensions.json` (SOUP's
`modules/extensions/directory.rs`, cached an hour). **Renaming this repository, its branch or that file breaks Browse in every
installed SOUP.** The README is the public guide (how to get listed, the rules, contact); keep it and this file in step.

## Commands (Node 20+, no dependencies)

```
npm test                    unit tests of the validator (test/validate.test.mjs)
npm run validate            schema + remote checks of new/changed entries (set GITHUB_TOKEN to avoid rate limits)
npm run validate:offline    the file only, no network
```

`.github/workflows/validate.yml` runs both on every pull request and push to `main`, comparing with the base list so only
changed entries are checked remotely.

## What the check enforces (`scripts/validate.mjs`)

Schema (`schema/extensions.schema.json`), unique `id` and `repo`, `official` only for `zachleolewis` repositories, one entry
added or changed per pull request, removals only by the entry's owner or the maintainer, and for the changed entry: a public
repository whose latest release has `manifest.json` + `main.js` (or `extension.zip`) with a matching `id`, `name`, `author`,
semver `version` equal to the tag, and an id that is not reserved.

`RESERVED_IDS` must list every built-in SOUP module id (SOUP refuses a manifest with one). When SOUP gains a module, add its id.
SOUP enforces the `official` owner rule too (`OFFICIAL_OWNER` in `directory.rs`); change both together.

## Reviewing a listing pull request

The check cannot judge these; the maintainer does, by reading the repository:
- an OSI-approved license, and the source matches the release (no obfuscated or minified-only code);
- `uses` in the manifest is honest for what the code does;
- no hidden telemetry; no Riot tokens, PUUIDs or personal data sent anywhere without telling the user;
- Riot's rules and SOUP's responsibility guide (no client or game automation, nothing that shows what the game hides).

Merge = listed. Listing is not a security review; every install in SOUP still shows the warning.

## Rules

- Entries are appended at the end; never reorder others' entries.
- `official: true` only for extensions the maintainer makes (currently Drive Sync).
- Extension authors' docs live in `zachleolewis/SOUP-Tools-Extensions`; link there instead of copying them here.
- No private paths, tokens or secrets in this public repository.

## Documentation is part of the work

The SOUP Tools owner's rule (2026-11-02) for every agent and contributor in every SOUP Tools repository: keep the documentation
excellent, tidy and current, so the next person or agent can continue the work cold.

1. **Read before you work**: this repository's handover, index and decisions; do not re-derive or re-ask what is written down.
2. **Write as you go**: findings, measurements (with the command, data and machine), decisions (with the reason and who decided),
   dead ends and why, gotchas, and what you could not verify, in the document that owns the topic.
3. **One home per fact**: other documents link to it. Adding, moving or removing a document updates the index that lists it in the
   same commit.
4. **The owner's words are kept word for word**, then turned into numbered decisions; a decision changes by a new entry that
   supersedes the old one.
5. **Status lines and absolute dates** on every plan and spec; superseded documents are archived with a pointer.
6. **Close every session**: update the handover or progress notes, record what you noticed and left, say plainly what was not verified.
7. **A change that touches another SOUP Tools repository** updates that repository's documentation too.
8. **Tidy**: no stale TODOs, no docs or comments describing code that changed, ASCII text.
