(() => {
  'use strict';

  const root = document.querySelector('[data-crossword-app]');
  if (!root) return;

  document.documentElement.classList.add('js');

  const puzzles = [
    {
      title: 'The Record',
      words: ['OTHER', 'THERE', 'HEART', 'ERROR', 'RETRO'],
      clues: [
        ['Not this one', 'Alternative to this'],
        ['In that place', 'A location being indicated'],
        ['Symbol of courage or affection', 'The organ at the center of circulation'],
        ['A mistake in print or judgment', 'Computer message nobody wants'],
        ['Deliberately old-fashioned', 'Style inspired by an earlier era']
      ]
    },
    {
      title: 'The Haven',
      words: ['THESE', 'HAVEN', 'EVENT', 'SENSE', 'ENTER'],
      clues: [
        ['The ones close at hand', 'Plural demonstrative'],
        ['A place of safety', 'Sheltered harbor'],
        ['A scheduled occurrence', 'Something noteworthy that happens'],
        ['Meaning or good judgment', 'One of sight, sound, smell, taste, or touch'],
        ['Go in', 'Keyboard key used to submit']
      ]
    },
    {
      title: 'The Assignment',
      words: ['GREAT', 'RIDGE', 'EDGES', 'AGENT', 'TESTS'],
      clues: [
        ['Excellent', 'Large in degree or importance'],
        ['Long narrow crest', 'Raised line on a roof or mountain'],
        ['Outer boundaries', 'Sharp sides of a blade'],
        ['Representative acting for another', 'Person who gets things moving'],
        ['Examinations', 'Checks whether something works']
      ]
    },
    {
      title: 'The Statehouse',
      words: ['STATE', 'TIMID', 'AMONG', 'TINGE', 'EDGES'],
      clues: [
        ['Condition or political territory', 'Declare formally'],
        ['Lacking confidence', 'Easily frightened'],
        ['In the company of', 'Surrounded by'],
        ['A slight trace of color', 'Flavor something faintly'],
        ['Borders and margins', 'Moves gradually toward']
      ]
    },
    {
      title: 'The Testimony',
      words: ['HEARD', 'ENTER', 'ATONE', 'RENTS', 'DRESS'],
      clues: [
        ['Perceived by ear', 'Received as testimony'],
        ['Come inside', 'Record information in a field'],
        ['Make amends', 'Seek to repair a wrong'],
        ['Payments to a landlord', 'Tears apart'],
        ['Put on formal clothing', 'A garment for an occasion']
      ]
    },
    {
      title: 'The Editorial',
      words: ['POWER', 'OLIVE', 'WIVES', 'EVENT', 'RESTS'],
      clues: [
        ['Authority or energy', 'Ability to act'],
        ['Fruit pressed for oil', 'Muted green shade'],
        ['Married women', 'Spouses in the plural'],
        ['Public happening', 'Competition on a program'],
        ['Takes a break', 'Remaining portions']
      ]
    },
    {
      title: 'The Copy Desk',
      words: ['WORDS', 'OPERA', 'RENAL', 'DRAFT', 'SALTS'],
      clues: [
        ['A writer arranges these', 'Units of language'],
        ['Drama set to music', 'A grand stage work'],
        ['Related to the kidneys', 'Medical adjective for kidney function'],
        ['An early version', 'Selects a player for a team'],
        ['Seasoning compounds', 'Preserves food with minerals']
      ]
    }
  ];

  const grid = root.querySelector('[data-crossword-grid]');
  const across = root.querySelector('[data-crossword-across]');
  const down = root.querySelector('[data-crossword-down]');
  const title = root.querySelector('[data-crossword-title]');
  const deck = root.querySelector('[data-crossword-deck]');
  const status = root.querySelector('[data-crossword-status]');
  const checkButton = root.querySelector('[data-crossword-check]');
  const revealButton = root.querySelector('[data-crossword-reveal]');
  const resetButton = root.querySelector('[data-crossword-reset]');
  const nextButton = root.querySelector('[data-crossword-next]');

  const dayNumber = Math.floor(Date.now() / 86400000);
  let selected = dayNumber % puzzles.length;
  let cells = [];

  function storageKey(index) {
    return `tahai-press-crossword-v1-${index}`;
  }

  function answerAt(puzzle, row, column) {
    return puzzle.words[row][column];
  }

  function save() {
    try {
      localStorage.setItem(storageKey(selected), cells.map((cell) => cell.value || '').join(''));
    } catch {
      // The puzzle remains fully usable when storage is unavailable.
    }
  }

  function restore() {
    try {
      const value = localStorage.getItem(storageKey(selected)) || '';
      cells.forEach((cell, index) => { cell.value = /^[A-Z]$/.test(value[index] || '') ? value[index] : ''; });
    } catch {
      cells.forEach((cell) => { cell.value = ''; });
    }
  }

  function setStatus(message, state = '') {
    status.textContent = message;
    status.dataset.state = state;
  }

  function focusCell(row, column) {
    const safeRow = Math.max(0, Math.min(4, row));
    const safeColumn = Math.max(0, Math.min(4, column));
    cells[(safeRow * 5) + safeColumn]?.focus();
  }

  function clueList(puzzle, direction) {
    return puzzle.words.map((word, index) => {
      const item = document.createElement('li');
      const number = document.createElement('span');
      const text = document.createElement('span');
      number.textContent = `${index + 1}`;
      text.textContent = puzzle.clues[index][direction === 'across' ? 0 : 1];
      item.dataset.word = word;
      item.append(number, text);
      return item;
    });
  }

  function render(index) {
    selected = (index + puzzles.length) % puzzles.length;
    const puzzle = puzzles[selected];
    grid.replaceChildren();
    across.replaceChildren(...clueList(puzzle, 'across'));
    down.replaceChildren(...clueList(puzzle, 'down'));
    title.textContent = `${puzzle.title} · Mini No. ${selected + 1}`;
    deck.textContent = selected === dayNumber % puzzles.length
      ? "Today's five-by-five word square."
      : 'Alternate edition selected for testing.';

    cells = [];
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const cell = document.createElement('label');
        cell.className = 'crossword-cell';
        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'text';
        input.autocomplete = 'off';
        input.autocapitalize = 'characters';
        input.spellcheck = false;
        input.maxLength = 1;
        input.dataset.row = String(row);
        input.dataset.column = String(column);
        input.setAttribute('aria-label', `Row ${row + 1}, column ${column + 1}`);
        if (row === 0 || column === 0) {
          const number = document.createElement('span');
          number.className = 'crossword-cell-number';
          number.textContent = row === 0 ? String(column + 1) : String(row + 1);
          cell.append(number);
        }
        cell.append(input);
        grid.append(cell);
        cells.push(input);
      }
    }

    restore();
    setStatus('Enter one letter in each square. Progress stays in this browser.');

    cells.forEach((input) => {
      input.addEventListener('input', () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
        input.removeAttribute('aria-invalid');
        input.closest('.crossword-cell')?.classList.remove('is-wrong', 'is-correct');
        save();
        if (input.value) {
          const row = Number(input.dataset.row);
          const column = Number(input.dataset.column);
          if (column < 4) focusCell(row, column + 1);
          else if (row < 4) focusCell(row + 1, 0);
        }
      });
      input.addEventListener('keydown', (event) => {
        const row = Number(input.dataset.row);
        const column = Number(input.dataset.column);
        if (event.key === 'ArrowLeft') { event.preventDefault(); focusCell(row, column - 1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); focusCell(row, column + 1); }
        if (event.key === 'ArrowUp') { event.preventDefault(); focusCell(row - 1, column); }
        if (event.key === 'ArrowDown') { event.preventDefault(); focusCell(row + 1, column); }
        if (event.key === 'Backspace' && !input.value && (row > 0 || column > 0)) {
          event.preventDefault();
          focusCell(column > 0 ? row : row - 1, column > 0 ? column - 1 : 4);
        }
      });
    });
  }

  checkButton.addEventListener('click', () => {
    const puzzle = puzzles[selected];
    let correct = 0;
    let filled = 0;
    cells.forEach((cell) => {
      const row = Number(cell.dataset.row);
      const column = Number(cell.dataset.column);
      const expected = answerAt(puzzle, row, column);
      const wrapper = cell.closest('.crossword-cell');
      wrapper?.classList.remove('is-wrong', 'is-correct');
      cell.removeAttribute('aria-invalid');
      if (cell.value) filled += 1;
      if (cell.value === expected) {
        correct += 1;
        wrapper?.classList.add('is-correct');
      } else if (cell.value) {
        wrapper?.classList.add('is-wrong');
        cell.setAttribute('aria-invalid', 'true');
      }
    });
    if (correct === 25) setStatus('Perfect. The edition is complete.', 'solved');
    else if (!filled) setStatus('The grid is still blank.', 'notice');
    else setStatus(`${correct} of 25 letters are correct.`, 'checked');
  });

  revealButton.addEventListener('click', () => {
    const puzzle = puzzles[selected];
    cells.forEach((cell) => {
      const row = Number(cell.dataset.row);
      const column = Number(cell.dataset.column);
      cell.value = answerAt(puzzle, row, column);
      cell.removeAttribute('aria-invalid');
      cell.closest('.crossword-cell')?.classList.remove('is-wrong');
      cell.closest('.crossword-cell')?.classList.add('is-correct');
    });
    save();
    setStatus('Answers revealed. Try another edition with Next puzzle.', 'revealed');
  });

  resetButton.addEventListener('click', () => {
    cells.forEach((cell) => {
      cell.value = '';
      cell.removeAttribute('aria-invalid');
      cell.closest('.crossword-cell')?.classList.remove('is-wrong', 'is-correct');
    });
    save();
    setStatus('Puzzle reset.');
    cells[0]?.focus();
  });

  nextButton.addEventListener('click', () => render(selected + 1));

  render(selected);
})();
