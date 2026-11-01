# SOUP Tools Community

The approved directory of community extensions for [SOUP Tools](https://github.com/zachleolewis/SOUP-Tools-Releases).

The directory is one file, [`extensions.json`](extensions.json). An extension is **listed** when a pull request adding its entry has been reviewed and merged. Modeled on Obsidian's `obsidian-releases`.

## How SOUP uses it

In SOUP, **Settings > Extensions > Browse** shows this list: search, name, author, description, an **Official** badge, and whether it is installed or has an update. **Install** goes through the usual GitHub install dialog (with SOUP's warning), and installs the extension from the **latest GitHub release** of the entry's `repo`. Updates work as for any GitHub extension: SOUP finds newer releases itself. The list is cached for an hour, and the last copy is kept for offline use.

If an entry is removed from this list, installed copies are not uninstalled; the card just says it is no longer listed.

## How to submit

1. **Build your extension** from the [extension template](https://github.com/zachleolewis/SOUP-Tools-Extensions) (guides: [manifest](https://github.com/zachleolewis/SOUP-Tools-Extensions/blob/main/docs/03-manifest.md), [publishing](https://github.com/zachleolewis/SOUP-Tools-Extensions/blob/main/docs/15-publishing.md)). Make sure the manifest has `id`, `name`, `version`, `minAppVersion`, `apiVersion`, `author`, and an honest `uses`.
2. **Publish a GitHub release.** With the template's `release.yml`, pushing a tag equal to the manifest `version` (`git tag v1.0.0 && git push --follow-tags`) attaches `manifest.json`, `main.js`, `styles.css` (if any) and `extension.zip`. The repository must be **public** and have an **OSI-approved open-source license**.
3. **Check it installs**: in SOUP, Settings > Extensions > From GitHub > `owner/name`.
4. **Fork this repository** and add **one entry at the end** of `extensions.json`:

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
5. **Open a pull request** and fill in the checklist. A check runs automatically (see below); fix what it reports and push again. A maintainer then reviews and merges. Merging is approval.

You can run the check yourself: `npm run validate` (set `GITHUB_TOKEN` to avoid GitHub's rate limit), or `npm run validate:offline` to check only the file. Node 20 or newer, no dependencies.

## Review rules

- The repository is **public** with an **OSI-approved open-source license**.
- The **latest GitHub release** has `manifest.json` and `main.js` (and optionally `styles.css`), or `extension.zip`. Its tag equals the manifest `version`.
- The manifest `id`, `name` and `author` match your entry. `version` is semver; `minAppVersion` and `apiVersion` are present. The `id` follows SOUP's rule: 1 to 40 lowercase letters, digits and dashes, no leading or trailing dash, not starting with `soup`, not the id of a built-in module.
- `uses` in the manifest **declares honestly** what the extension does (`riot`, `network`, `filesystem`, `processes`, `windows`, `clipboard`).
- The **source in the repository matches the release**. No obfuscated code, and no minified-only code without its source.
- **No telemetry** unless the README says what is sent, where, and how to turn it off. Never send tokens, PUUIDs or personal data without telling the person.
- It **respects Riot's rules** and SOUP's [responsibility guide](https://github.com/zachleolewis/SOUP-Tools-Extensions/blob/main/docs/17-responsibility.md): no automating the client or the game, no showing information the game hides.
- **One entry per pull request.**

The automatic check enforces what a program can: the JSON schema, unique `id` and `repo` (case-insensitive), `official` only for `zachleolewis` repositories, at most one entry added or changed per pull request, and for the new or changed entry, a public repository whose latest release has the right files and a manifest that matches. A person checks the rest (license, source, honesty of `uses`, Riot's rules).

## What "listed" means

Listed means **reviewed for listing**, not a security guarantee. An extension runs with the same access as SOUP itself. Every install still shows SOUP's warning, and nothing here changes that. Read the source before you install anything.

## Updating your extension

Publish a new GitHub release. **No pull request is needed**; SOUP reads the latest release. You only need a pull request to change your listing text (`name`, `author`, `description`) or `repo`; if `id` or `name` in a new release stops matching your entry, the listing breaks, so change both together.

## Being removed

Open a pull request deleting your entry (the owner of the repository, or the maintainer, can do this). Maintainers may also remove an entry that breaks these rules or whose repository disappears.

## The Official badge

`"official": true` is only for extensions maintained by the SOUP maintainer (`zachleolewis`): the check refuses it for any other repository owner.

## License

[MIT](LICENSE) for the contents of this repository. Each listed extension has its own license.
