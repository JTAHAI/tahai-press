# Data Desk

Datasets in `content/datasets/` are validated before build and render as static pages with a text summary, accessible HTML table, methodology, definitions, units, limitations, source link, downloadable source file, print output, and no-JavaScript fallback. Charts are deliberately optional: a chart cannot replace the table or text record.

The local workflow is: prepare a CSV or JSON source, review its fields and definitions, place the downloadable source under `public/downloads/`, create a dataset record, run `npm run validate`, then build and inspect the static page. Do not publish a source file containing private or restricted material.
