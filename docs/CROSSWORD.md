# Static Crossword

TAHAI Press includes a rotating five-by-five mini crossword at `/puzzles/`.

## Design

- Puzzle data is bundled in `public/assets/crossword.js`.
- Seven editions rotate using the UTC day number.
- No network request, account, database, or third-party puzzle service is used.
- Browser storage preserves each edition's local progress when available.
- Check, reveal, reset, next-edition, arrow-key, and backspace behavior are included.
- The grid and controls are labeled for keyboard and assistive-technology use.

## Replacing puzzles

Each puzzle contains:

```js
{
  title: 'The Record',
  words: ['OTHER', 'THERE', 'HEART', 'ERROR', 'RETRO'],
  clues: [
    ['Across clue', 'Down clue']
  ]
}
```

The included editions are word squares: each row and corresponding column spell the same answer. Replacement editions must contain five uppercase five-letter words whose columns form the same word list.

Run `npm test` after modifying puzzle data. The crossword test verifies route generation, local-only behavior, controls, and five-by-five puzzle structure.
