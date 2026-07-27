# Branding a fork

The boilerplate can be rebranded without changing the generator or stylesheet.

## Identity fields

Edit `content/site.json` directly or use the **Site settings → Publication settings** screen in Pages CMS.

- `title`: full masthead name.
- `short_title`: browser-title suffix and compact name.
- `brand_mark`: one or two letters displayed in the default circular mark.
- `tagline`: line below the masthead.
- `masthead_kicker`: top publication bar.
- `hero_kicker`, `hero_title`, `hero_description`: homepage introduction.
- `editorial_promise`: displayed in homepage and article callouts.
- `navigation_note`: compact note on wide navigation layouts.
- `footer_note`: project credit or publication statement.

## Theme fields

Every theme value must be a six-digit hex color such as `#17324d`.

- `brand`: primary color.
- `brand_deep`: dark masthead, footer, and contrast surface.
- `brand_soft`: pale brand surface.
- `accent`: action and active-navigation color.
- `accent_dark`: accessible link and eyebrow color.
- `highlight`: decorative rule and mark color.
- `surface`: warm or neutral secondary background.
- `surface_deep`: stronger secondary surface.
- `paper`: main page background.

Unsafe or malformed values are rejected by validation and also fall back to the built-in palette at render time.

## Logo strategy

The default generated letter mark requires no image asset and is appropriate for a fresh fork. A later pass can add image-logo rendering, social-card generation, and richer asset guidance. The existing `logo` and `default_social_image` fields are preserved for that work.

## Public attribution

The Apache 2.0 license applies to the software source and redistributed source distributions. TAHAI Press does not require publishers to display a public banner, powered-by line, footer credit, logo, backlink, hidden link, or other visible project attribution on generated publication pages. When `template_mode` is disabled, the public surface is the publisher's own.
