# Cloudflare Pages direct upload

TAHAI Press release packages include a ready-to-upload deployment ZIP. Its archive root contains `index.html`, `_redirects`, assets, routes, feeds, and well-known build metadata; there is no wrapping `dist/` directory.

## Use the release ZIP

1. Open the Cloudflare dashboard.
2. Open **Workers & Pages** and the demo Pages project.
3. Choose **Create deployment** or **Upload assets**.
4. Upload `tahai-press_vX.Y.Z_cloudflare-deploy.zip`.
5. Open the deployment URL and test `/publisher/`, `/studio/`, `/media-desk/`, and one article.

The included demo remains `noindex` while `content/site.json` has `template_mode: true`.

## Build your own ZIP on Windows

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\deployment\package-cloudflare-direct-upload.ps1
```

## Build your own ZIP on Linux or WSL

```bash
./deployment/package-cloudflare-direct-upload.sh
```

Both scripts run the full Cloudflare build gate before packaging. The ZIP contains the **contents** of `dist/`, not the directory itself.
