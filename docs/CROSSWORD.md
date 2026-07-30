# Static crossword desk

TAHAI Press includes a rotating, browser-only crossword desk at `/puzzles/`. Puzzles are ordinary JSON records in Git, editable through Pages CMS, validated during the build, and delivered as static data with no puzzle service or runtime database.

## Difficulty modes

### Novice mini

- five-by-five open grids;
- compact mobile-friendly play;
- quick clue sets suited to a short daily break;
- seven included demonstration editions.

### Expert blocked grid

- newspaper-style blocked grids;
- black squares and numbered starts;
- longer entries and independent Across and Down clues;
- multiple included fifteen-by-fifteen demonstration editions.

## Content location

Each puzzle is stored in:

```text
content/crosswords/<slug>.json
```

The build validates every active puzzle, then emits a sanitized public data file at:

```text
/assets/crosswords.json
```

The puzzle page also embeds the same sanitized data so the player can initialize without a fetch request.

## Record shape

```json
{
  "slug": "novice-edition-one",
  "title": "Novice Edition One",
  "difficulty": "novice",
  "deck": "A quick five-by-five newsroom break.",
  "active": true,
  "rotation_order": 1,
  "grid": [
    "ABCDE",
    "BCDEA",
    "CDEAB",
    "DEABC",
    "EABCD"
  ],
  "clues": [
    {
      "number": 1,
      "direction": "across",
      "answer": "ABCDE",
      "clue": "Example clue"
    }
  ]
}
```

The included records contain real playable clue sets rather than the illustrative values above.

## Pages CMS workflow

1. Open **Crossword desk**.
2. Create or duplicate a puzzle record.
3. Choose Novice or Expert.
4. Enter one grid row per list item, using uppercase letters for open cells and `#` for black squares.
5. Add every Across and Down clue with its number, answer, and direction.
6. Choose a unique positive rotation order within that difficulty.
7. Keep `active` off until the puzzle validates.
8. Run `npm run validate` and `npm test` before activating it.

## Validation rules

The build rejects:

- duplicate slugs;
- filenames that do not match the slug;
- non-square grids;
- characters other than uppercase A–Z and `#`;
- Novice grids that are not five-by-five;
- Expert grids smaller than nine-by-nine;
- missing clues for generated entries;
- clue answers that do not match the grid;
- duplicate active rotation positions within a difficulty;
- a publication with no active Novice or no active Expert puzzle.

## Rotation and privacy

- The date selects the initial active puzzle within the selected difficulty.
- **Next puzzle** rotates through the active set.
- Novice and Expert progress are stored separately in local browser storage.
- No API, account, analytics request, database, or third-party provider is used.
- The player never sends answers or progress to the publisher.

## Controls

- Type one letter per open square.
- Use arrow keys for direct movement.
- Press Space to switch Across/Down direction.
- Click a clue to focus its first square.
- **Check answers** marks filled letters.
- **Reveal** fills the current grid.
- **Reset** clears the current edition.
- **Next puzzle** rotates within the selected difficulty.
- **Print puzzle** opens the browser print flow with controls and answer letters suppressed.

## Removing the crossword

A publisher that does not want puzzles can remove the Crossword homepage/navigation modules, delete the crossword route entry from the site configuration, and remove the sample puzzle records. The publishing platform does not depend on the crossword desk.
