import '../styles/board-editor.css';
import { BOARD } from '@mechmarathon/shared';
import { api } from '../lib/api.js';
import { navigateTo } from '../lib/router.js';

const ARROW_MAP = { north: '\u2191', south: '\u2193', east: '\u2192', west: '\u2190' };
const SYMBOL_MAP = {
  floor: '', conveyor: '', express_conveyor: '', pit: '\u2716',
  gear_cw: '\u21BB', gear_ccw: '\u21BA', repair: '\u2692', laser: '\u2301', spawn: '\u2605',
};
const TYPE_LABELS = {
  floor: 'Floor', conveyor: 'Conveyor', express_conveyor: 'Express', gear_cw: 'Gear CW',
  gear_ccw: 'Gear CCW', pit: 'Pit', repair: 'Repair', laser: 'Laser', spawn: 'Spawn',
};

let tiles = [];
let boardName = '';
let boardDescription = '';
let boardId = null;
let selectedTool = 'floor';
let selectedDirection = 'north';
let wallMode = false;
let saving = false;
let error = '';
let isDragging = false;

function initTiles() {
  tiles = [];
  for (let y = 0; y < BOARD.SIZE; y++) {
    const row = [];
    for (let x = 0; x < BOARD.SIZE; x++) {
      row.push({ type: 'floor' });
    }
    tiles.push(row);
  }
}

export function render(container, params) {
  boardId = params?.id || null;
  error = '';
  saving = false;

  if (boardId) {
    api(`/api/boards/${boardId}`).then((board) => {
      boardName = board.name;
      boardDescription = board.description || '';
      tiles = board.tiles;
      update();
    }).catch((e) => {
      error = e.message;
      initTiles();
      update();
    });
  } else {
    boardName = '';
    boardDescription = '';
    initTiles();
  }

  function update() {
    const canSave = boardName.length >= BOARD.NAME_MIN_LENGTH && !saving;
    const hasContent = tiles.some((row) => row.some((t) => t.type !== 'floor'));

    container.innerHTML = `
      <div class="board-editor">
        <div class="board-editor-header">
          <h2>${boardId ? 'Edit Board' : 'New Board'}</h2>
          <div class="actions">
            <a href="/boards" data-link class="btn btn-secondary">Back</a>
            <button class="btn" id="save-btn" ${!canSave ? 'disabled' : ''}>${saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>

        ${error ? `<p class="error">${error}</p>` : ''}

        <div class="board-editor-body">
          <div class="editor-toolbar">
            <h4>Tiles</h4>
            ${BOARD.TILE_TYPES.map((t) => `
              <button class="tool-btn ${selectedTool === t && !wallMode ? 'active' : ''}" data-tool="${t}">
                ${TYPE_LABELS[t]}
              </button>
            `).join('')}

            <h4>Tools</h4>
            <button class="tool-btn ${wallMode ? 'active' : ''}" id="wall-mode-btn">Wall Mode</button>
            <button class="tool-btn" id="eraser-btn">Eraser</button>
            <button class="tool-btn" id="clear-btn">Clear All</button>

            ${['conveyor', 'express_conveyor', 'laser'].includes(selectedTool) && !wallMode ? `
              <h4>Direction</h4>
              <div class="direction-picker">
                <span class="spacer"></span>
                <button class="${selectedDirection === 'north' ? 'active' : ''}" data-dir="north">\u2191 N</button>
                <span class="spacer"></span>
                <button class="${selectedDirection === 'west' ? 'active' : ''}" data-dir="west">\u2190 W</button>
                <span class="spacer"></span>
                <button class="${selectedDirection === 'east' ? 'active' : ''}" data-dir="east">\u2192 E</button>
                <span class="spacer"></span>
                <button class="${selectedDirection === 'south' ? 'active' : ''}" data-dir="south">\u2193 S</button>
                <span class="spacer"></span>
              </div>
            ` : ''}
          </div>

          <div class="editor-grid-wrapper">
            <div class="editor-grid" id="editor-grid">
              ${tiles.map((row, y) => row.map((tile, x) => {
                const wallHtml = (tile.walls || []).map((w) => `<div class="wall wall-${w}"></div>`).join('');
                const arrow = tile.direction ? `<span class="arrow">${ARROW_MAP[tile.direction]}</span>` : '';
                const symbol = SYMBOL_MAP[tile.type] || '';
                return `<div class="editor-cell" data-type="${tile.type}" data-x="${x}" data-y="${y}">
                  ${wallHtml}${arrow || symbol}
                </div>`;
              }).join('')).join('')}
            </div>
          </div>

          <div class="editor-sidebar">
            <label>
              Name
              <input type="text" id="board-name" value="${escapeAttr(boardName)}"
                maxlength="${BOARD.NAME_MAX_LENGTH}" placeholder="Board name" />
            </label>
            <label>
              Description
              <textarea id="board-desc" maxlength="${BOARD.DESCRIPTION_MAX_LENGTH}"
                placeholder="Optional description">${escapeHtml(boardDescription)}</textarea>
            </label>
            <div class="checklist">
              <div class="${boardName.length >= BOARD.NAME_MIN_LENGTH ? 'ok' : 'fail'}">
                ${boardName.length >= BOARD.NAME_MIN_LENGTH ? '\u2713' : '\u2717'} Name (${BOARD.NAME_MIN_LENGTH}+ chars)
              </div>
              <div class="${hasContent ? 'ok' : 'fail'}">
                ${hasContent ? '\u2713' : '\u2717'} Has non-floor tiles
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    attachListeners();
  }

  function attachListeners() {
    // Tool buttons
    container.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedTool = btn.dataset.tool;
        wallMode = false;
        update();
      });
    });

    // Wall mode
    container.querySelector('#wall-mode-btn')?.addEventListener('click', () => {
      wallMode = !wallMode;
      update();
    });

    // Eraser
    container.querySelector('#eraser-btn')?.addEventListener('click', () => {
      selectedTool = 'floor';
      wallMode = false;
      update();
    });

    // Clear all
    container.querySelector('#clear-btn')?.addEventListener('click', () => {
      initTiles();
      update();
    });

    // Direction picker
    container.querySelectorAll('.direction-picker button').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedDirection = btn.dataset.dir;
        update();
      });
    });

    // Name/description inputs
    container.querySelector('#board-name')?.addEventListener('input', (e) => {
      boardName = e.target.value;
      // Update save button + checklist without full re-render
      const saveBtn = container.querySelector('#save-btn');
      if (saveBtn) saveBtn.disabled = boardName.length < BOARD.NAME_MIN_LENGTH || saving;
    });

    container.querySelector('#board-desc')?.addEventListener('input', (e) => {
      boardDescription = e.target.value;
    });

    // Grid interactions
    const grid = container.querySelector('#editor-grid');
    if (!grid) return;

    grid.addEventListener('mousedown', (e) => {
      const cell = e.target.closest('.editor-cell');
      if (!cell) return;
      isDragging = true;
      handleCellInteraction(cell, e);
    });

    grid.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const cell = e.target.closest('.editor-cell');
      if (!cell) return;
      handleCellInteraction(cell, e);
    });

    document.addEventListener('mouseup', () => { isDragging = false; });

    // Save
    container.querySelector('#save-btn')?.addEventListener('click', handleSave);
  }

  function handleCellInteraction(cell, e) {
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);

    if (wallMode) {
      // Detect which edge was clicked based on offset
      const rect = cell.getBoundingClientRect();
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      const threshold = 10;

      let wallDir = null;
      if (oy < threshold) wallDir = 'north';
      else if (oy > rect.height - threshold) wallDir = 'south';
      else if (ox < threshold) wallDir = 'west';
      else if (ox > rect.width - threshold) wallDir = 'east';

      if (wallDir) {
        const tile = tiles[y][x];
        const walls = tile.walls || [];
        const idx = walls.indexOf(wallDir);
        if (idx >= 0) {
          walls.splice(idx, 1);
        } else {
          walls.push(wallDir);
        }
        tiles[y][x] = { ...tile, walls: walls.length > 0 ? walls : undefined };
        updateCell(cell, x, y);
      }
      return;
    }

    // Paint tile
    const newTile = { type: selectedTool };
    if (['conveyor', 'express_conveyor', 'laser'].includes(selectedTool)) {
      newTile.direction = selectedDirection;
    }
    // Preserve existing walls
    const existingWalls = tiles[y][x].walls;
    if (existingWalls && existingWalls.length > 0) {
      newTile.walls = existingWalls;
    }
    tiles[y][x] = newTile;
    updateCell(cell, x, y);
  }

  function updateCell(cell, x, y) {
    const tile = tiles[y][x];
    cell.setAttribute('data-type', tile.type);
    const wallHtml = (tile.walls || []).map((w) => `<div class="wall wall-${w}"></div>`).join('');
    const arrow = tile.direction ? `<span class="arrow">${ARROW_MAP[tile.direction]}</span>` : '';
    const symbol = SYMBOL_MAP[tile.type] || '';
    cell.innerHTML = `${wallHtml}${arrow || symbol}`;
  }

  async function handleSave() {
    if (saving) return;
    saving = true;
    error = '';
    update();

    try {
      // Clean tiles: strip undefined walls
      const cleanTiles = tiles.map((row) =>
        row.map((t) => {
          const clean = { type: t.type };
          if (t.direction) clean.direction = t.direction;
          if (t.walls && t.walls.length > 0) clean.walls = t.walls;
          return clean;
        })
      );

      if (boardId) {
        await api(`/api/boards/${boardId}`, {
          method: 'PUT',
          body: JSON.stringify({ name: boardName, description: boardDescription, tiles: cleanTiles }),
        });
      } else {
        const result = await api('/api/boards', {
          method: 'POST',
          body: JSON.stringify({ name: boardName, description: boardDescription, tiles: cleanTiles }),
        });
        boardId = result.id;
      }
      navigateTo('/boards');
    } catch (e) {
      error = e.message;
      saving = false;
      update();
    }
  }

  update();
}

export function unmount() {
  boardId = null;
  boardName = '';
  boardDescription = '';
  tiles = [];
  isDragging = false;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
