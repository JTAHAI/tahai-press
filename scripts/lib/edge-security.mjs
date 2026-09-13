const BASE_HEADERS = Object.freeze([
  ['Content-Security-Policy', "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self'; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests"],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['Cross-Origin-Resource-Policy', 'same-origin'],
  ['Permissions-Policy', 'camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY']
]);

export function edgeSecurityHeaders({ indexingBlocked = false } = {}) {
  return [
    ...BASE_HEADERS.map(([name, value]) => ({ name, value })),
    ...(indexingBlocked ? [{ name: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] : [])
  ];
}

export function cloudflareHeadersText({ indexingBlocked = false } = {}) {
  const headers = edgeSecurityHeaders({ indexingBlocked });
  return [
    '/*',
    ...headers.map(({ name, value }) => `  ${name}: ${value}`),
    '',
    '/.well-known/*',
    '  Cache-Control: no-store',
    '',
    '/robots.txt',
    '  Cache-Control: no-store',
    '',
    '/service-worker.js',
    '  Cache-Control: no-cache, no-store, must-revalidate',
    ''
  ].join('\n');
}
