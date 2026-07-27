# Static crossword desk

TAHAI Press includes a rotating, browser-only crossword desk at `/puzzles/`.

## Difficulty modes

### Novice mini

- Seven hand-set five-by-five word-square editions
- Matching Across and Down answers
- Quick daily play with a compact mobile-friendly grid

### Expert blocked grid

- Multiple fifteen-by-fifteen newspaper-style grids
- Black squares and numbered starts
- Longer reporting, public-records, and newsroom vocabulary
- Independent Across and Down clue lists
- Clickable clues and direction-aware keyboard movement

## Privacy and durability

- Puzzle data is bundled in `public/assets/crossword.js`.
- No API, account, analytics request, database, or third-party puzzle service is used.
- Progress is stored only in the reader's local browser storage.
- The date selects the initial puzzle; **Next puzzle** allows testing all editions.
- Novice and Expert progress are stored separately.

## Controls

- Type one letter per open square.
- Use arrow keys for direct movement.
- Press Space to switch Across/Down entry direction.
- Click a clue to focus its first square.
- **Check answers** marks filled letters.
- **Reveal** fills the current grid.
- **Reset** clears only the current edition.
- **Next puzzle** rotates within the selected difficulty.

Run `npm test` after modifying puzzle data. Tests verify both difficulty modes, blocked expert grids, local-only behavior, controls, and generated route markup.
