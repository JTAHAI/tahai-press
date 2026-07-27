# Contributing

Thank you for helping improve the TAHAI Press.

## Development workflow

1. Use Node.js 22 or later.
2. Create a focused branch.
3. Run `npm run ci` before opening a pull request. Use `npm run validate:cms` after changing `.pages.yml` or the article schema.
4. Keep the generator dependency-free unless a dependency is clearly justified.
5. Do not add publication-specific names, logos, copied articles, or private records to the starter.
6. Include tests for changes to content validation, route generation, navigation, deployment behavior, import behavior, or visual tokens.
7. Review the Cloudflare Pages preview before merging publication-visible changes into `main`.

## Scope

The project is intended to remain a reusable static publishing foundation. Site-specific migrations and branding should live in downstream forks or separate migration branches. Never commit third-party exports, private source files, generated migration reports, or imported records to this boilerplate repository.
---

**Created by Justin Tahai and TAHAI Web Services**  
**[https://tahai.net](https://tahai.net)**

