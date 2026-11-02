<!-- One extension per pull request. Add exactly one entry at the END of extensions.json. -->

**Extension:** <!-- name and https://github.com/owner/name -->

## Checklist

- [ ] My entry is the only change, added at the end of `extensions.json`, and it is valid JSON.
- [ ] The repository is public and has an OSI-approved open-source license.
- [ ] The latest GitHub release has `manifest.json` and `main.js` (and `styles.css` if I have styles), or `extension.zip`, and the tag equals the manifest `version`.
- [ ] The manifest `id`, `name` and `author` match my entry, and `version`, `minAppVersion` and `apiVersion` are set.
- [ ] `uses` in the manifest honestly lists what the extension does (`riot`, `network`, `filesystem`, `processes`, `windows`, `clipboard`, `accounts`).
- [ ] The source in the repository matches the release; there is no obfuscated or minified-only code without its source.
- [ ] The extension sends no telemetry, or the README says clearly what is sent, where, and how to turn it off.
- [ ] I read Riot's rules and SOUP's responsibility guide, and the extension does not break them.
- [ ] I did not set `official` (only for extensions maintained by `zachleolewis`).
