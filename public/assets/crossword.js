(() => {
  'use strict';

  const root = document.querySelector('[data-crossword-app]');
  if (!root) return;
  const dataNode = document.querySelector('#crossword-data');
  let payload = { puzzles: [] };
  try { payload = JSON.parse(dataNode?.textContent || '{"puzzles":[]}'); } catch {}
  const puzzles = Array.isArray(payload.puzzles) ? payload.puzzles : [];
  const collections = {
    novice: puzzles.filter((item) => item.difficulty === 'novice'),
    expert: puzzles.filter((item) => item.difficulty === 'expert')
  };

  document.documentElement.classList.add('js');

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
  const printButton = root.querySelector('[data-crossword-print]');
  const modeButtons = [...root.querySelectorAll('[data-crossword-mode]')];

  if (!collections.novice.length || !collections.expert.length) {
    root.dataset.crosswordState = 'unavailable';
    title.textContent = 'Crossword desk unavailable';
    deck.textContent = 'The puzzle collection is incomplete. An editor can restore it from Pages CMS.';
    status.textContent = 'No complete novice and expert puzzle collections were found.';
    root.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    return;
  }

  const dayNumber = Math.floor(Date.now() / 86400000);
  let mode = 'novice';
  let selected = dayNumber % collections[mode].length;
  let puzzle = collections[mode][selected];
  let cells = [];
  let cellByCoordinate = new Map();
  let entries = [];
  let activeDirection = 'across';

  function storageKey() {
    return `tahai-press-crossword-v3-${puzzle.slug}`;
  }

  function cellKey(row, column) {
    return `${row}:${column}`;
  }

  function scanEntries(current) {
    const size = current.grid.length;
    const found = [];
    let number = 0;
    const numberByStart = new Map();
    const clueMap = new Map((current.clues || []).map((clue) => [`${clue.direction}:${clue.answer}`, clue.clue]));

    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        if (current.grid[row][column] === '#') continue;
        const acrossStart = (column === 0 || current.grid[row][column - 1] === '#') && column + 1 < size && current.grid[row][column + 1] !== '#';
        const downStart = (row === 0 || current.grid[row - 1][column] === '#') && row + 1 < size && current.grid[row + 1][column] !== '#';
        if (!acrossStart && !downStart) continue;
        number += 1;
        numberByStart.set(cellKey(row, column), number);

        if (acrossStart) {
          let answer = '';
          let cursor = column;
          while (cursor < size && current.grid[row][cursor] !== '#') answer += current.grid[row][cursor++];
          found.push({ number, direction: 'across', row, column, answer, clue: clueMap.get(`across:${answer}`) || `Across entry ${number}` });
        }
        if (downStart) {
          let answer = '';
          let cursor = row;
          while (cursor < size && current.grid[cursor][column] !== '#') answer += current.grid[cursor++][column];
          found.push({ number, direction: 'down', row, column, answer, clue: clueMap.get(`down:${answer}`) || `Down entry ${number}` });
        }
      }
    }
    return { entries: found, numberByStart };
  }

  function answerAt(row, column) { return puzzle.grid[row][column]; }

  function save() {
    try {
      const state = Object.fromEntries(cells.map((cell) => [cellKey(cell.row, cell.column), cell.input.value || '']));
      localStorage.setItem(storageKey(), JSON.stringify(state));
    } catch {}
  }

  function restore() {
    try {
      const state = JSON.parse(localStorage.getItem(storageKey()) || '{}');
      cells.forEach(({ input, row, column }) => {
        const value = state[cellKey(row, column)] || '';
        input.value = /^[A-Z]$/.test(value) ? value : '';
      });
    } catch {
      cells.forEach(({ input }) => { input.value = ''; });
    }
  }

  function setStatus(message, state = '') {
    status.textContent = message;
    status.dataset.state = state;
  }

  function openCell(row, column) { return cellByCoordinate.get(cellKey(row, column)) || null; }
  function focusCell(row, column) { openCell(row, column)?.input.focus(); }

  function moveLinear(currentCell, step) {
    const target = cells[cells.indexOf(currentCell) + step];
    target?.input.focus();
  }

  function moveInDirection(currentCell, step) {
    const delta = activeDirection === 'across' ? [0, step] : [step, 0];
    let row = currentCell.row + delta[0];
    let column = currentCell.column + delta[1];
    const size = puzzle.grid.length;
    while (row >= 0 && column >= 0 && row < size && column < size) {
      const target = openCell(row, column);
      if (target) { target.input.focus(); return; }
      row += delta[0];
      column += delta[1];
    }
    moveLinear(currentCell, step);
  }

  function renderClues(direction) {
    const fragment = document.createDocumentFragment();
    entries.filter((entry) => entry.direction === direction).forEach((entry) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const number = document.createElement('span');
      const text = document.createElement('span');
      button.type = 'button';
      button.dataset.clueDirection = direction;
      button.dataset.clueRow = String(entry.row);
      button.dataset.clueColumn = String(entry.column);
      number.textContent = String(entry.number);
      text.textContent = entry.clue;
      button.append(number, text);
      button.addEventListener('click', () => { activeDirection = direction; focusCell(entry.row, entry.column); });
      item.append(button);
      fragment.append(item);
    });
    return fragment;
  }

  function updateModeButtons() {
    modeButtons.forEach((button) => {
      const active = button.dataset.crosswordMode === mode;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
    });
  }

  function render(index = selected) {
    const list = collections[mode];
    selected = (index + list.length) % list.length;
    puzzle = list[selected];
    const scan = scanEntries(puzzle);
    entries = scan.entries;
    const size = puzzle.grid.length;
    const dailyIndex = dayNumber % list.length;

    root.dataset.crosswordState = 'ready';
    root.dataset.crosswordDifficulty = mode;
    root.dataset.crosswordSlug = puzzle.slug;
    grid.replaceChildren();
    grid.style.setProperty('--crossword-size', String(size));
    grid.setAttribute('aria-label', `${size} by ${size} ${mode} crossword grid`);
    across.replaceChildren(renderClues('across'));
    down.replaceChildren(renderClues('down'));
    title.textContent = `${puzzle.title} · ${mode === 'expert' ? 'Expert' : 'Mini'} No. ${selected + 1}`;
    deck.textContent = selected === dailyIndex ? puzzle.deck : `Alternate ${mode} edition selected.`;

    cells = [];
    cellByCoordinate = new Map();
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        const character = puzzle.grid[row][column];
        const wrapper = document.createElement(character === '#' ? 'span' : 'label');
        wrapper.className = character === '#' ? 'crossword-cell is-blocked' : 'crossword-cell';
        if (character === '#') wrapper.setAttribute('aria-hidden', 'true');

        if (character !== '#') {
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
          const clueNumber = scan.numberByStart.get(cellKey(row, column));
          if (clueNumber) {
            const number = document.createElement('span');
            number.className = 'crossword-cell-number';
            number.textContent = String(clueNumber);
            wrapper.append(number);
          }
          wrapper.append(input);
          const cell = { input, wrapper, row, column };
          cells.push(cell);
          cellByCoordinate.set(cellKey(row, column), cell);
        }
        grid.append(wrapper);
      }
    }

    restore();
    updateModeButtons();
    setStatus(`${cells.length} open squares. Progress stays only in this browser.`);

    cells.forEach((cell) => {
      const { input, row, column, wrapper } = cell;
      input.addEventListener('focus', () => wrapper.classList.add('is-active'));
      input.addEventListener('blur', () => wrapper.classList.remove('is-active'));
      input.addEventListener('click', () => { activeDirection = activeDirection === 'across' ? 'down' : 'across'; });
      input.addEventListener('input', () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
        input.removeAttribute('aria-invalid');
        wrapper.classList.remove('is-wrong', 'is-correct');
        save();
        if (input.value) moveInDirection(cell, 1);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === ' ') { event.preventDefault(); activeDirection = activeDirection === 'across' ? 'down' : 'across'; setStatus(`Entry direction: ${activeDirection}.`, 'notice'); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); activeDirection = 'across'; focusCell(row, column - 1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); activeDirection = 'across'; focusCell(row, column + 1); }
        if (event.key === 'ArrowUp') { event.preventDefault(); activeDirection = 'down'; focusCell(row - 1, column); }
        if (event.key === 'ArrowDown') { event.preventDefault(); activeDirection = 'down'; focusCell(row + 1, column); }
        if (event.key === 'Backspace' && !input.value) { event.preventDefault(); moveInDirection(cell, -1); }
      });
    });
  }

  modeButtons.forEach((button) => button.addEventListener('click', () => {
    const nextMode = button.dataset.crosswordMode;
    if (!collections[nextMode]?.length || nextMode === mode) return;
    mode = nextMode;
    selected = dayNumber % collections[mode].length;
    activeDirection = 'across';
    render(selected);
  }));

  checkButton.addEventListener('click', () => {
    let correct = 0;
    let filled = 0;
    cells.forEach(({ input, wrapper, row, column }) => {
      const expected = answerAt(row, column);
      wrapper.classList.remove('is-wrong', 'is-correct');
      input.removeAttribute('aria-invalid');
      if (input.value) filled += 1;
      if (input.value === expected) { correct += 1; wrapper.classList.add('is-correct'); }
      else if (input.value) { wrapper.classList.add('is-wrong'); input.setAttribute('aria-invalid', 'true'); }
    });
    if (correct === cells.length) setStatus('Perfect. The edition is complete.', 'solved');
    else if (!filled) setStatus('The grid is still blank.', 'notice');
    else setStatus(`${correct} of ${cells.length} letters are correct.`, 'checked');
  });

  revealButton.addEventListener('click', () => {
    cells.forEach(({ input, wrapper, row, column }) => {
      input.value = answerAt(row, column);
      input.removeAttribute('aria-invalid');
      wrapper.classList.remove('is-wrong');
      wrapper.classList.add('is-correct');
    });
    save();
    setStatus('Answers revealed. Try another edition with Next puzzle.', 'revealed');
  });

  resetButton.addEventListener('click', () => {
    cells.forEach(({ input, wrapper }) => {
      input.value = '';
      input.removeAttribute('aria-invalid');
      wrapper.classList.remove('is-wrong', 'is-correct');
    });
    save();
    setStatus('Puzzle reset.');
    cells[0]?.input.focus();
  });

  nextButton.addEventListener('click', () => render(selected + 1));
  printButton?.addEventListener('click', () => window.print());
  render(selected);
})();
