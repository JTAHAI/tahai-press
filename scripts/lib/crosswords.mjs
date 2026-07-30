export const CROSSWORD_DIFFICULTIES = Object.freeze(['novice', 'expert']);

export function crosswordClueMap(puzzle = {}) {
  if (Array.isArray(puzzle.clues)) return new Map(puzzle.clues.map((item) => [`${item.direction}:${item.answer}`, item.clue]));
  return new Map(Object.entries(puzzle.clues || {}));
}

export function scanCrossword(puzzle = {}) {
  const grid = Array.isArray(puzzle.grid) ? puzzle.grid : [];
  const size = grid.length;
  const entries = [];
  let number = 0;
  const numberByStart = new Map();
  const key = (row, column) => `${row}:${column}`;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (grid[row]?.[column] === '#') continue;
      const acrossStart = (column === 0 || grid[row]?.[column - 1] === '#') && column + 1 < size && grid[row]?.[column + 1] !== '#';
      const downStart = (row === 0 || grid[row - 1]?.[column] === '#') && row + 1 < size && grid[row + 1]?.[column] !== '#';
      if (!acrossStart && !downStart) continue;
      number += 1;
      numberByStart.set(key(row, column), number);
      if (acrossStart) {
        let answer = '';
        for (let cursor = column; cursor < size && grid[row][cursor] !== '#'; cursor += 1) answer += grid[row][cursor];
        entries.push({ number, direction: 'across', row, column, answer });
      }
      if (downStart) {
        let answer = '';
        for (let cursor = row; cursor < size && grid[cursor][column] !== '#'; cursor += 1) answer += grid[cursor][column];
        entries.push({ number, direction: 'down', row, column, answer });
      }
    }
  }
  return { size, entries, numberByStart };
}

export function publicCrossword(puzzle = {}) {
  const scan = scanCrossword(puzzle);
  const clues = crosswordClueMap(puzzle);
  return {
    slug: puzzle.slug,
    title: puzzle.title,
    difficulty: puzzle.difficulty,
    deck: puzzle.deck,
    rotation_order: puzzle.rotation_order,
    grid: puzzle.grid,
    clues: scan.entries.map((entry) => ({
      ...entry,
      clue: clues.get(`${entry.direction}:${entry.answer}`) || ''
    }))
  };
}

export function validateCrossword(puzzle = {}) {
  const errors = [];
  const grid = Array.isArray(puzzle.grid) ? puzzle.grid : [];
  if (!CROSSWORD_DIFFICULTIES.includes(puzzle.difficulty)) errors.push('difficulty must be novice or expert');
  if (!grid.length) errors.push('grid must contain rows');
  const size = grid.length;
  if (size && !grid.every((row) => typeof row === 'string' && row.length === size)) errors.push('grid must be square and every row must have the same length');
  if (grid.some((row) => !/^[A-Z#]+$/.test(String(row)))) errors.push('grid may contain uppercase A-Z letters and # blocks only');
  if (puzzle.difficulty === 'novice' && size !== 5) errors.push('novice grids must be 5 by 5');
  if (puzzle.difficulty === 'expert' && size < 9) errors.push('expert grids must be at least 9 by 9');
  const open = grid.join('').replaceAll('#', '').length;
  if (open < 15) errors.push('grid must contain at least 15 open squares');
  const scan = scanCrossword(puzzle);
  const clues = crosswordClueMap(puzzle);
  if (Array.isArray(puzzle.clues)) {
    for (const [index, item] of puzzle.clues.entries()) {
      if (!item || !['across', 'down'].includes(item.direction) || !/^[A-Z]+$/.test(String(item.answer || '')) || !String(item.clue || '').trim()) errors.push(`clues[${index}] must include direction, uppercase answer, and clue text`);
    }
  }
  for (const entry of scan.entries) {
    const clue = clues.get(`${entry.direction}:${entry.answer}`);
    if (!String(clue || '').trim()) errors.push(`missing clue for ${entry.direction}:${entry.answer}`);
  }
  if (scan.entries.some((entry) => entry.answer.length < 2)) errors.push('entries must contain at least two letters');
  return errors;
}
