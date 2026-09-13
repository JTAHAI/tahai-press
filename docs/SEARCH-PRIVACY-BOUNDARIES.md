# Search privacy boundaries

Only published public article records are serialized into `search-index.json` or eligible for Pagefind. The build marks noindex operational pages—including setup, writing, media, saved-reading, and private tools—with `data-pagefind-ignore`. Pagefind is generated locally and ships as same-origin static assets; no search request is sent to a third party.
