#!/usr/bin/env bash
set -o errexit
set -o nounset
set -o pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
version="$(node -p "require('./package.json').version")"
output="${1:-$repo_root/tahai-press_v${version}_cloudflare-deploy.zip}"
npm run build:cloudflare
rm -f "$output"
(
  cd dist
  zip -q -r "$output" .
)
printf 'Cloudflare Pages direct-upload ZIP: %s\n' "$output"
