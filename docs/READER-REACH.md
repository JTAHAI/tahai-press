# Reader Reach

TAHAI Press Reader Reach adds useful return-visit features without creating a reader-account system, application database, analytics profile, or third-party service dependency.

## Product rule

> Make it easy. Make it fast. Make it accessible.

Every feature is progressive enhancement over ordinary static HTML. Finished pages remain readable when JavaScript, local storage, installation prompts, or service workers are unavailable.

## Configuration

Reader Reach is configured in `content/site.json` and Pages CMS:

```json
{
  "reader_reach": {
    "enabled": true,
    "offline_enabled": true,
    "saved_articles_enabled": true,
    "browser_share_enabled": true,
    "current_edition_enabled": true,
    "current_edition_count": 8,
    "offline_article_count": 12
  }
}
```

Counts must be integers from 1 through 50. Disabling `reader_reach.enabled` removes the generated reader controls and routes.

## Installable offline reading

When offline reading is enabled, the build generates:

- `/service-worker.js`
- `/site.webmanifest`
- `/offline/`

The service worker caches only same-origin publication routes and assets. It does not contact an analytics endpoint, advertising network, content API, or remote cache service.

The first successful online visit stores the core publication shell and the configured number of recent articles. Navigation remains network-first so readers receive fresh publishing when connected. When the network is unavailable, TAHAI Press serves the cached route or the plain-language offline fallback.

Installation behavior varies by browser and operating system. TAHAI Press reveals an Install control only when the browser exposes an installation prompt. Readers can always use their browser menu to add the publication to a home screen when supported.

## Saved-story library

Article pages include a browser-local **Save story** control when enabled. The saved record contains only:

- the site-relative article URL;
- headline;
- short summary;
- publication date;
- local save time.

Up to 100 records are retained under the `tahai-press-saved-articles-v1` local-storage key. `/saved/` reads that local list and builds accessible story cards in the browser. Readers can remove individual records or clear the list.

No saved-story information is sent to the publisher. Clearing browser data removes the list.

## Browser sharing

The Share control uses `navigator.share()` when supported. Otherwise, TAHAI Press copies the article URL to the clipboard. Status messages use a polite live region and do not rely on color alone.

The feature never injects social-network scripts or tracking pixels. Readers decide which installed application receives the link.

## Printable current edition

`/edition/` lists the newest published work in a formal newspaper layout. It includes classifications, headlines, summaries, bylines, dates, permanent article links, and a print control.

Print CSS removes navigation, interactive controls, template notices, and footer furniture. The result remains legible in grayscale and does not require JavaScript to print through the browser menu.

## Accessibility behavior

- Save controls expose `aria-pressed` state.
- Share, save, install, and clear actions announce outcomes through status regions.
- Saved-story cards are created with DOM APIs and text nodes rather than injected untrusted HTML.
- The offline route contains a real page heading, navigation alternatives, and connection status.
- The current edition uses an ordered list and permanent article links.
- Every control has visible keyboard focus and meets the existing target-size contract.
- Forced-colors and print modes preserve meaning.

## Privacy and security

Reader Reach does not add:

- reader registration;
- publisher-side saved lists;
- cross-device synchronization;
- analytics;
- push notification subscriptions;
- remote service-worker code;
- third-party sharing widgets;
- background content submission.

The service worker rejects cross-origin requests and handles only same-origin `GET` requests. Source validation and deployment verification confirm the generated files and routes before release.

## Publisher identity

The demonstration manifest uses TAHAI Press icons. When `template_mode` is disabled, the manifest uses the publisher's site-relative logo or the neutral project favicon. Reader Reach does not require visible TAHAI Press credit on a publisher's public pages.
