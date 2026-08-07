# Theme Workshop

Theme Workshop is the local theme workflow. Its package format exposes documented tokens for color, typography, spacing, density, image treatment, reader surfaces, and print while keeping publisher content and rendering logic outside the theme.

The production workshop server is deliberately not published in reader output. Any future local UI must bind to `127.0.0.1`, protect write operations with an unpredictable token, and use the same package validation as the command line before activation or export.
