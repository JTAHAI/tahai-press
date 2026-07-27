(() => {
  'use strict';

  const root = document.querySelector('[data-crossword-app]');
  if (!root) return;

  document.documentElement.classList.add('js');

  const noviceWordSquares = [
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

  const novicePuzzles = noviceWordSquares.map((puzzle) => ({
    difficulty: 'novice',
    title: puzzle.title,
    deck: 'A five-by-five word square with matching Across and Down answers.',
    grid: puzzle.words,
    clueMap: Object.fromEntries(puzzle.words.flatMap((word, index) => [
      [`across:${word}`, puzzle.clues[index][0]],
      [`down:${word}`, puzzle.clues[index][1]]
    ]))
  }));

  const expertPuzzles = [
    {
      difficulty: 'expert',
      title: 'The Data Desk',
      deck: 'A blocked fifteen-by-fifteen newsroom crossword with longer entries.',
      grid: [
        '#FOOTNOTE######',
        '####I##########',
        '##E#M##########',
        '##V#E##PRIMARY#',
        '##I#L#F####T###',
        '##D#I#A#CONTEXT',
        '##E#N#C####R###',
        '#INVESTIGATION#',
        '##C###C##N#B###',
        '##E###H##A#U###',
        '######E##L#T###',
        '##SOURCE#Y#I###',
        '######K##S#O###',
        '#########I#N###',
        '###DATABASE####'
      ],
      clueMap: {
        'across:FOOTNOTE': 'Citation or explanatory note attached to the record',
        'down:TIMELINE': 'Events arranged in chronological order',
        'down:EVIDENCE': 'Material offered to establish a fact',
        'across:PRIMARY': 'Firsthand, as a source document',
        'down:FACTCHECK': 'Verification performed before publication',
        'down:ATTRIBUTION': 'Identification of where a statement or fact came from',
        'across:CONTEXT': 'Surrounding facts that give a statement meaning',
        'across:INVESTIGATION': 'Sustained inquiry into a matter of public importance',
        'down:ANALYSIS': 'Detailed examination of information or evidence',
        'across:SOURCE': 'Origin of information used in reporting',
        'across:DATABASE': 'Structured collection of searchable information'
      }
    },
    {
      difficulty: 'expert',
      title: 'The Local Desk',
      deck: 'A civic-news grid built around community reporting and public institutions.',
      grid: [
        '###############',
        '#MUNICIPAL#####',
        '#######R####W##',
        '#J##FREEDOM#A##',
        '#O#B###S####T##',
        '#U#Y###S####C##',
        '#R#L###R####H##',
        '#NEIGHBORHOOD##',
        '#A#N###O#E##O##',
        '#L#E###M#A##G##',
        '#I#######D#####',
        '#S#######L#####',
        '#M#COMMUNITY###',
        '#########N#####',
        '#####STATEHOUSE'
      ],
      clueMap: {
        'across:MUNICIPAL': 'Relating to a city or town government',
        'down:PRESSROOM': 'Workspace where reporters gather and file stories',
        'down:WATCHDOG': 'Person or organization monitoring those in power',
        'down:JOURNALISM': 'The work of gathering, verifying, and publishing news',
        'across:FREEDOM': 'Liberty protected by the First Amendment',
        'down:BYLINE': 'Line identifying the author of a story',
        'across:NEIGHBORHOOD': 'A local area whose residents share a community',
        'down:HEADLINE': 'Title set above a news article',
        'across:COMMUNITY': 'People connected by place, interest, or civic life',
        'across:STATEHOUSE': 'Building where a state legislature meets'
      }
    },
    {
      difficulty: 'expert',
      title: 'The Copy Desk',
      deck: 'A publication-workflow crossword featuring reporting, editing, and public records.',
      grid: [
        '########RECORDS',
        '#DEADLINE######',
        '########P######',
        '##N####SOURCING',
        '##E#####R######',
        '##W##TESTIMONY#',
        '##S#####E######',
        '#TRANSPARENCY##',
        '##O####R#######',
        '##O##DOCUMENT##',
        '##M####H#######',
        '#####EDITORIAL#',
        '#######V#######',
        '###CORRECTION##',
        '###############'
      ],
      clueMap: {
        'across:RECORDS': 'Documents preserved as evidence of activity or decisions',
        'down:REPORTER': 'Journalist who gathers and verifies information',
        'across:DEADLINE': 'Latest time by which copy must be filed',
        'down:NEWSROOM': 'Editorial workplace of a publication',
        'across:SOURCING': 'Process of establishing where information comes from',
        'across:TESTIMONY': 'Statement given by a witness',
        'across:TRANSPARENCY': 'Openness that allows decisions and records to be examined',
        'down:ARCHIVE': 'Collection maintained for long-term access',
        'across:DOCUMENT': 'Written or recorded item supporting the public record',
        'across:EDITORIAL': 'Article expressing an institutional opinion',
        'across:CORRECTION': 'Published repair of a factual error'
      }
    }
  ];

  const collections = { novice: novicePuzzles, expert: expertPuzzles };
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
  const modeButtons = [...root.querySelectorAll('[data-crossword-mode]')];

  const dayNumber = Math.floor(Date.now() / 86400000);
  let mode = 'novice';
  let selected = dayNumber % collections[mode].length;
  let puzzle = collections[mode][selected];
  let cells = [];
  let cellByCoordinate = new Map();
  let entries = [];
  let activeDirection = 'across';

  function storageKey() {
    return `tahai-press-crossword-v2-${mode}-${selected}`;
  }

  function cellKey(row, column) {
    return `${row}:${column}`;
  }

  function scanEntries(current) {
    const size = current.grid.length;
    const found = [];
    let number = 0;
    const numberByStart = new Map();

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
          while (cursor < size && current.grid[row][cursor] !== '#') {
            answer += current.grid[row][cursor];
            cursor += 1;
          }
          found.push({ number, direction: 'across', row, column, answer, clue: current.clueMap[`across:${answer}`] || `Across entry ${answer}` });
        }
        if (downStart) {
          let answer = '';
          let cursor = row;
          while (cursor < size && current.grid[cursor][column] !== '#') {
            answer += current.grid[cursor][column];
            cursor += 1;
          }
          found.push({ number, direction: 'down', row, column, answer, clue: current.clueMap[`down:${answer}`] || `Down entry ${answer}` });
        }
      }
    }
    return { entries: found, numberByStart };
  }

  function answerAt(row, column) {
    return puzzle.grid[row][column];
  }

  function save() {
    try {
      const state = Object.fromEntries(cells.map((cell) => [cellKey(cell.row, cell.column), cell.input.value || '']));
      localStorage.setItem(storageKey(), JSON.stringify(state));
    } catch {
      // The puzzle remains fully usable when storage is unavailable.
    }
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

  function openCell(row, column) {
    return cellByCoordinate.get(cellKey(row, column)) || null;
  }

  function focusCell(row, column) {
    openCell(row, column)?.input.focus();
  }

  function moveLinear(currentCell, step) {
    const index = cells.indexOf(currentCell);
    const target = cells[index + step];
    target?.input.focus();
  }

  function moveInDirection(currentCell, step) {
    const delta = activeDirection === 'across' ? [0, step] : [step, 0];
    let row = currentCell.row + delta[0];
    let column = currentCell.column + delta[1];
    const size = puzzle.grid.length;
    while (row >= 0 && column >= 0 && row < size && column < size) {
      const target = openCell(row, column);
      if (target) {
        target.input.focus();
        return;
      }
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
      button.addEventListener('click', () => {
        activeDirection = direction;
        focusCell(entry.row, entry.column);
      });
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
        wrapper.setAttribute('aria-hidden', character === '#' ? 'true' : 'false');

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
        if (event.key === ' ') {
          event.preventDefault();
          activeDirection = activeDirection === 'across' ? 'down' : 'across';
          setStatus(`Entry direction: ${activeDirection}.`, 'notice');
        }
        if (event.key === 'ArrowLeft') { event.preventDefault(); activeDirection = 'across'; focusCell(row, column - 1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); activeDirection = 'across'; focusCell(row, column + 1); }
        if (event.key === 'ArrowUp') { event.preventDefault(); activeDirection = 'down'; focusCell(row - 1, column); }
        if (event.key === 'ArrowDown') { event.preventDefault(); activeDirection = 'down'; focusCell(row + 1, column); }
        if (event.key === 'Backspace' && !input.value) {
          event.preventDefault();
          moveInDirection(cell, -1);
        }
      });
    });
  }

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.dataset.crosswordMode;
      if (!collections[nextMode] || nextMode === mode) return;
      mode = nextMode;
      selected = dayNumber % collections[mode].length;
      activeDirection = 'across';
      render(selected);
    });
  });

  checkButton.addEventListener('click', () => {
    let correct = 0;
    let filled = 0;
    cells.forEach(({ input, wrapper, row, column }) => {
      const expected = answerAt(row, column);
      wrapper.classList.remove('is-wrong', 'is-correct');
      input.removeAttribute('aria-invalid');
      if (input.value) filled += 1;
      if (input.value === expected) {
        correct += 1;
        wrapper.classList.add('is-correct');
      } else if (input.value) {
        wrapper.classList.add('is-wrong');
        input.setAttribute('aria-invalid', 'true');
      }
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

  render(selected);
})();
