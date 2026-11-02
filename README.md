# SOUP Tools Community Extensions

The official list of approved community extensions for [SOUP Tools](https://zachleolewis.github.io/soup-tools/)
([download](https://github.com/zachleolewis/SOUP-Tools-Releases/releases/latest)).

Everything in SOUP's **Settings > Extensions > Browse** comes from one file in this repository:
[`extensions.json`](extensions.json). Each entry points to a public GitHub repository that holds the extension; SOUP installs
and updates it from that repository's latest release. An extension gets on the list when a pull request adding its entry is
reviewed and merged.

## Where to start: making an extension

All the code, docs and examples for building a SOUP extension are in
**[zachleolewis/SOUP-Tools-Extensions](https://github.com/zachleolewis/SOUP-Tools-Extensions)**:

- [`template/`](https://github.com/zachleolewis/SOUP-Tools-Extensions/tree/main/template): copy this to start a new extension
  (build setup and a release workflow included).
- [`docs/`](https://github.com/zachleolewis/SOUP-Tools-Extensions/tree/main/docs): the guides, from your first extension to
  the [manifest](https://github.com/zachleolewis/SOUP-Tools-Extensions/blob/main/docs/03-manifest.md),
  [publishing](https://github.com/zachleolewis/SOUP-Tools-Extensions/blob/main/docs/15-publishing.md) and the
  [responsibility guide](https://github.com/zachleolewis/SOUP-Tools-Extensions/blob/main/docs/17-responsibility.md).
- [`examples/`](https://github.com/zachleolewis/SOUP-Tools-Extensions/tree/main/examples): four working extensions to learn from.
- `types/soup.d.ts`: the typed `soup` API.

A complete, real extension to look at:
[SOUP-Tools-Drive-Sync-Extension](https://github.com/zachleolewis/SOUP-Tools-Drive-Sync-Extension) (Google Drive backup).

## How to get listed

1. **Build your extension** from the template. The manifest needs `id`, `name`, `version`, `minAppVersion`, `apiVersion`,
   `author`, and an honest `uses`.
2. **Put it in its own public GitHub repository** with an OSI-approved open-source license (MIT, Apache-2.0, GPL, ...).
3. **Publish a GitHub release.** With the template's release workflow, push a tag equal to the manifest `version`
   (`git tag v1.0.0 && git push --follow-tags`). The release gets `manifest.json`, `main.js` and `styles.css` (if any), or
   `extension.zip`.
4. **Check that it installs**: in SOUP, Settings > Extensions > From GitHub > `owner/name`.
5. **Fork this repository** and add **one entry at the end** of `extensions.json`:

   ```json
   {
     "id": "heatmap",
     "name": "Heatmap",
     "author": "Your name",
     "description": "Kill heatmaps on the real minimap.",
     "repo": "your-github-name/heatmap"
   }
   ```

   `id`, `name` and `author` must match your manifest. `description` is at most 250 characters. Do not add `official`.
6. **Open a pull request** and fill in the checklist. An automatic check runs; fix what it reports and push again. The
   maintainer then reviews it. **Merged means listed.**

You can run the check yourself before opening the pull request: `npm run validate` (Node 20+, no dependencies; set
`GITHUB_TOKEN` to avoid GitHub's rate limit), or `npm run validate:offline` to check only the file.

## Rules for the official list

An extension is listed only if all of these hold:

- **Public and open source.** The repository is public with an OSI-approved open-source license, and the **source in the
  repository matches the release**: no obfuscated code, and no minified-only code without its source.
- **A proper release.** The latest GitHub release has `manifest.json` and `main.js` (optionally `styles.css`), or
  `extension.zip`, and its tag equals the manifest `version` (`v` prefix allowed).
- **Matching manifest.** The manifest `id`, `name` and `author` match your entry; `version` is semver; `minAppVersion` and
  `apiVersion` are set. The `id` is 1 to 40 lowercase letters, digits and dashes, no leading or trailing dash, does not start
  with `soup`, and is not the id of a built-in module.
- **Honest `uses`.** The manifest declares what the extension really does (`riot`, `network`, `filesystem`, `processes`,
  `windows`, `clipboard`, `accounts`).
- **No hidden data collection.** No telemetry unless the README says what is sent, where, and how to turn it off. Never send
  Riot tokens, PUUIDs or personal data anywhere without telling the person.
- **Riot's rules.** It follows Riot's rules and SOUP's
  [responsibility guide](https://github.com/zachleolewis/SOUP-Tools-Extensions/blob/main/docs/17-responsibility.md): no
  automating the client or the game, no showing information the game hides, nothing that could get a player banned.
- **One entry per pull request.**

The automatic check enforces what a program can: the JSON schema, a unique `id` and `repo`, `official` only for the
maintainer's repositories, one entry added or changed per pull request, and for that entry a public repository whose latest
release has the right files and a matching manifest. A person checks the rest (license, source, honest `uses`, Riot's rules).

## What "listed" means

Listed means **reviewed for listing**, not a security guarantee. An extension runs with the same access as SOUP itself. Every
install still shows SOUP's warning, and extensions start in Restricted mode. Read the source before you install anything.

## Updating your extension

Publish a new GitHub release; **no pull request is needed**, SOUP picks up the latest release by itself. Open a pull request
only to change your listing (`name`, `author`, `description` or `repo`). If `id` or `name` in a new release stops matching your
entry, the listing breaks, so change both together.

## Being removed

Open a pull request deleting your entry. The maintainer may also remove an entry that breaks these rules or whose repository
disappears. Installed copies are never uninstalled; SOUP just shows "no longer listed".

## The Official badge

`"official": true` marks extensions made by the SOUP maintainer (`zachleolewis`). The check refuses it for anyone else.

## Questions

Ask before you start or if your pull request is stuck:

- Discord: **soup0330**
- X / Twitter: **[@soupzachary](https://x.com/soupzachary)**
- Or open an issue in this repository.

## License

[MIT](LICENSE) for the contents of this repository. Each listed extension has its own license.
