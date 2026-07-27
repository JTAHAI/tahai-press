# Quick Start

```bash
git clone https://github.com/JTAHAI/tahai-press.git
cd tahai-press
npm run ci
npm run preview
```

Open `http://localhost:8788`.

For Cloudflare Pages use:

```text
Build command: npm run build:cloudflare
Output directory: dist
Node version: 22
```

Edit `content/site.json`, replace sample content, upload the publisher's logo and social image, set the final HTTPS site URL, then disable `template_mode` before launch.
