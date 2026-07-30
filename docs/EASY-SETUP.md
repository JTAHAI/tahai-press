# Easy Setup

TAHAI Press is designed around one product rule:

> **Make it easy. Make it fast. Make it accessible.**

The first deployment includes Launch Desk at `/setup/`. It runs entirely in the publisher's browser, sends no publication details to a server, and requires no account beyond the GitHub and Cloudflare accounts already used by the project. Pages CMS signs in through GitHub.

## Seven-step first-day newsroom

1. **Start here** — see the complete ten-minute path before making a change.
2. **Name the publication** — enter the name, live address, and public contact email.
3. **Choose the look** — select one of eight contrast-tested newspaper themes.
4. **Shape the front page** — keep recommended sections, adjust their order, and simplify the menu.
5. **Connect the editor** — confirm GitHub, Pages CMS, and Cloudflare Pages.
6. **Write the first story** — replace a useful example instead of beginning with an empty editor.
7. **Review and launch** — preview, download a backup, remove demonstration stories, and prepare the final launch package.

Only one step is visible at a time. Each screen has one primary action. Advanced choices remain collapsed until the publisher opens them.

## Progress and recovery

Launch Desk stores progress in local browser storage. The data remains on that device and is never sent to TAHAI Press or another service.

The publisher can:

- resume at the last step;
- see progress such as “4 of 7 launch steps complete”;
- undo the most recent setup change;
- reset the local setup state;
- download the original configuration and sample article as a backup;
- preview the masthead, navigation, theme, and first headline before applying anything.

The `Start here` link appears prominently throughout the demonstration site and displays the locally stored completion count.

## Recommended settings

Every decision screen includes a recommended option. The defaults prioritize:

- accessible contrast;
- familiar newspaper hierarchy;
- standard reading width;
- balanced spacing;
- a short navigation menu;
- Reader Reach without tracking or reader accounts;
- a first article saved as Draft rather than published automatically.

Raw color editing and complex page-builder controls are intentionally excluded from Launch Desk.

## Built-in themes

- Classic Broadsheet
- Community Weekly
- Civic Record
- Modern Daily
- Investigative Journal
- Arts & Culture
- High Contrast
- Warm Reading Edition

Every preset is checked by the automated contrast suite. The normal build still fails when required contrast pairs no longer pass.

## Launch package

The final action downloads:

```text
tahai-press-launch-package.json
```

The package contains:

- the completed `content/site.json` configuration;
- `template_mode: false`;
- the sample-article removal list;
- a first-story Draft;
- a publisher-named editorial-team author record;
- package version and generation metadata.

Apply it from the repository with:

```bash
npm run launch:apply -- --package tahai-press-launch-package.json --confirm
```

The command first copies affected files into `.artifacts/launch-backup-<timestamp>/`. It then removes the four sample stories, writes the publication configuration, creates the first-story Draft, and updates the generic editorial-team record.

Chrome and Edge can perform the same work directly through the native folder picker. The publisher must explicitly choose the repository folder and grant write access. Browsers without secure folder access continue to use the downloadable package.

## Launch safety

Launch Desk does not:

- publish the first story automatically;
- upload a logo or article image;
- infer alternative text;
- create a user account;
- send form data to a server;
- change a repository without explicit folder permission;
- remove the Apache 2.0 source license or notices;
- require visible TAHAI Press credit on the publisher's public website.

After applying a package, run:

```bash
npm run validate
npm test
npm run build:cloudflare
```

The setup route and progress asset disappear automatically when `template_mode` is `false`.
