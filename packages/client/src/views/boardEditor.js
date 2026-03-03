import '../styles/board-editor.css';
import { BOARD } from '@mechmarathon/shared';
import { api } from '../lib/api.js';
import { navigateTo } from '../lib/router.js';

const ARROW_MAP = { north: '\u2191', south: '\u2193', east: '\u2192', west: '\u2190' };
const SYMBOL_MAP = {
  floor: '', conveyor: '', express_conveyor: '', pit: '\u2716', trap_pit: '\u2716',
  gear_cw: '\u21BB', gear_ccw: '\u21BA', repair: '\u2692', spawn: '\u2605',
  oil_slick: '\u{1F4A7}', water: '\u2248', current: '',
  portal: '\u{1F300}', drain: '\u2B07', radioactive_drain: '\u2622',
  teleporter: '\u{1F4AB}', randomizer: '\u{1F3B2}', repulsor: '\u{1F6D1}',
  radiation: '\u2622', radioactive_waste: '\u2623', chop_shop: '\u{1F527}',
  ledge: '\u2581', ramp: '\u2F00',
};
const TYPE_LABELS = {
  floor: 'Floor', conveyor: 'Conveyor', express_conveyor: 'Express', gear_cw: 'Gear CW',
  gear_ccw: 'Gear CCW', pit: 'Pit', trap_pit: 'Trap Pit', repair: 'Repair', spawn: 'Spawn',
  oil_slick: 'Oil Slick', water: 'Water', current: 'Current',
  portal: 'Portal', drain: 'Drain', radioactive_drain: 'Rad. Drain',
  teleporter: 'Teleporter', randomizer: 'Randomizer', repulsor: 'Repulsor',
  radiation: 'Radiation', radioactive_waste: 'Rad. Waste', chop_shop: 'Chop Shop',
  ledge: 'Ledge', ramp: 'Ramp',
};

const PORTAL_GROUPS = ['A', 'B', 'C', 'D'];

const SIDE_FEATURE_LABELS = { laser: 'Laser', pusher: 'Pusher' };
const SIDE_FEATURE_SYMBOLS = { laser: '\u26A1', pusher: '\u25B6' };

const OVERLAY_LABELS = { flamer: 'Flamer', crusher: 'Crusher' };
const OVERLAY_SYMBOLS = { flamer: '\u{1F525}', crusher: '\u2B07' };

// Elements that need phase selection
const PHASE_ELEMENTS = new Set(['pusher', 'flamer', 'crusher', 'trap_pit']);

let tiles = [];
let boardName = '';
let boardDescription = '';
let boardId = null;
let selectedTool = 'floor';
let selectedDirection = 'north';
let selectedSideFeature = null; // 'laser', 'pusher'
let selectedOverlay = null; // 'flamer', 'crusher'
let selectedStrength = 1;
let selectedEntry = []; // for conveyor curves/merges
let selectedPhases = [1, 3, 5]; // default active phases for new phase-based elements
let selectedGroup = 'A'; // for portal pairing
let selectedElevation = 0; // elevation level 0/1/2
let wallMode = false;
let oneWayWallMode = false;
let selectedBlocks = 'entry'; // 'entry' or 'exit'
let saving = false;
let error = '';
let isDragging = false;
let selectedCell = null; // {x, y} for tile info display

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
    const hasContent = tiles.some((row) => row.some((t) => t.type !== 'floor' || t.sideFeatures?.length || t.overlays?.length));
    const isGroundMode = !wallMode && !oneWayWallMode && !selectedSideFeature && !selectedOverlay;
    const isSideFeatureMode = !!selectedSideFeature && !wallMode && !oneWayWallMode;
    const isOverlayMode = !!selectedOverlay && !wallMode && !oneWayWallMode;
    const needsDirection = isGroundMode && ['conveyor', 'express_conveyor', 'current', 'ramp'].includes(selectedTool);

    // Determine if current tool needs phase selector
    const needsPhases = (isSideFeatureMode && PHASE_ELEMENTS.has(selectedSideFeature))
      || (isOverlayMode && PHASE_ELEMENTS.has(selectedOverlay))
      || (isGroundMode && PHASE_ELEMENTS.has(selectedTool));

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
              <button class="tool-btn ${selectedTool === t && isGroundMode ? 'active' : ''}" data-tool="${t}">
                ${TYPE_LABELS[t] || t}
              </button>
            `).join('')}

            <h4>Side Features</h4>
            ${BOARD.SIDE_FEATURE_TYPES.map((t) => `
              <button class="tool-btn ${selectedSideFeature === t ? 'active' : ''}" data-side-feature="${t}">
                ${SIDE_FEATURE_LABELS[t] || t}
              </button>
            `).join('')}

            <h4>Overlays</h4>
            ${BOARD.OVERLAY_TYPES.map((t) => `
              <button class="tool-btn ${selectedOverlay === t ? 'active' : ''}" data-overlay="${t}">
                ${OVERLAY_LABELS[t] || t}
              </button>
            `).join('')}

            <h4>Tools</h4>
            <button class="tool-btn ${wallMode ? 'active' : ''}" id="wall-mode-btn">Wall Mode</button>
            <button class="tool-btn ${oneWayWallMode ? 'active' : ''}" id="oneway-wall-mode-btn">One-Way Wall</button>
            <button class="tool-btn" id="eraser-btn">Eraser</button>
            <button class="tool-btn" id="clear-btn">Clear All</button>

            ${oneWayWallMode ? `
              <h4>Blocks</h4>
              <div class="blocks-picker">
                <button class="blocks-btn ${selectedBlocks === 'entry' ? 'active' : ''}" data-blocks="entry">Entry</button>
                <button class="blocks-btn ${selectedBlocks === 'exit' ? 'active' : ''}" data-blocks="exit">Exit</button>
              </div>
            ` : ''}

            ${needsDirection ? `
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

            ${needsDirection ? `
              <h4>Entry Sides <span class="help-text">(curve/merge)</span></h4>
              <div class="entry-picker">
                ${['north', 'south', 'east', 'west'].map((d) => `
                  <button class="entry-btn ${selectedEntry.includes(d) ? 'active' : ''}" data-entry="${d}">
                    ${ARROW_MAP[d]} ${d[0].toUpperCase()}
                  </button>
                `).join('')}
              </div>
            ` : ''}

            ${isSideFeatureMode && selectedSideFeature === 'laser' ? `
              <h4>Laser Strength</h4>
              <div class="strength-picker">
                ${[1, 2, 3].map((s) => `
                  <button class="${selectedStrength === s ? 'active' : ''}" data-strength="${s}">${s}</button>
                `).join('')}
              </div>
            ` : ''}

            ${needsPhases ? `
              <h4>Active Phases</h4>
              <div class="phase-picker">
                ${[1, 2, 3, 4, 5].map((p) => `
                  <button class="phase-btn ${selectedPhases.includes(p) ? 'active' : ''}" data-phase="${p}">${p}</button>
                `).join('')}
              </div>
            ` : ''}

            ${isGroundMode && selectedTool === 'portal' ? `
              <h4>Portal Group</h4>
              <div class="group-picker">
                ${PORTAL_GROUPS.map((g) => `
                  <button class="group-btn ${selectedGroup === g ? 'active' : ''}" data-group="${g}">${g}</button>
                `).join('')}
              </div>
            ` : ''}

            ${isGroundMode ? `
              <h4>Elevation</h4>
              <div class="elevation-picker">
                ${[0, 1, 2].map((e) => `
                  <button class="elevation-btn ${selectedElevation === e ? 'active' : ''}" data-elevation="${e}">${e}</button>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <div class="editor-grid-wrapper">
            <div class="editor-grid" id="editor-grid">
              ${tiles.map((row, y) => row.map((tile, x) => renderCell(tile, x, y)).join('')).join('')}
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

            ${selectedCell ? renderTileInfo(selectedCell.x, selectedCell.y) : ''}
          </div>
        </div>
      </div>
    `;

    attachListeners();
  }

  function renderCell(tile, x, y) {
    const wallHtml = (tile.walls || []).map((w) => `<div class="wall wall-${w}"></div>`).join('');
    const owWallHtml = (tile.oneWayWalls || []).map((ow) =>
      `<div class="oneway-wall oneway-wall-${ow.side}" data-blocks="${ow.blocks}" title="one-way ${ow.side} blocks ${ow.blocks}"></div>`
    ).join('');
    const sfHtml = (tile.sideFeatures || []).map((f) => {
      const symbol = SIDE_FEATURE_SYMBOLS[f.type] || '?';
      const title = f.type + (f.phases ? ` [${f.phases.join(',')}]` : '') + (f.strength > 1 ? ` str:${f.strength}` : '');
      return `<div class="side-feature side-feature-${f.side}" data-sf-type="${f.type}" title="${title}">${symbol}</div>`;
    }).join('');
    const overlayHtml = (tile.overlays || []).map((o) => {
      const symbol = OVERLAY_SYMBOLS[o.type] || '?';
      const title = o.type + (o.phases ? ` [${o.phases.join(',')}]` : '');
      return `<div class="overlay-indicator" data-overlay-type="${o.type}" title="${title}">${symbol}</div>`;
    }).join('');
    const entryHtml = (tile.entry || []).map((d) =>
      `<div class="entry-indicator entry-${d}"></div>`
    ).join('');
    const arrow = tile.direction ? `<span class="arrow">${ARROW_MAP[tile.direction]}</span>` : '';
    const symbol = SYMBOL_MAP[tile.type] || '';
    const phaseHtml = tile.phases?.length ? `<span class="phase-dots">${tile.phases.join('')}</span>` : '';
    const groupHtml = tile.group ? `<span class="group-label">${tile.group}</span>` : '';
    const elevHtml = tile.elevation > 0 ? `<span class="elevation-badge">E${tile.elevation}</span>` : '';
    const isSelected = selectedCell && selectedCell.x === x && selectedCell.y === y;
    return `<div class="editor-cell ${isSelected ? 'selected' : ''}" data-type="${tile.type}" data-x="${x}" data-y="${y}">
      ${wallHtml}${owWallHtml}${sfHtml}${overlayHtml}${entryHtml}${arrow || symbol}${phaseHtml}${groupHtml}${elevHtml}
    </div>`;
  }

  function renderTileInfo(x, y) {
    const tile = tiles[y][x];
    const parts = [`<h4>Tile (${x}, ${y})</h4>`];
    parts.push(`<div class="tile-info-row">Ground: <strong>${TYPE_LABELS[tile.type] || tile.type}</strong></div>`);
    if (tile.direction) parts.push(`<div class="tile-info-row">Direction: ${tile.direction}</div>`);
    if (tile.elevation > 0) parts.push(`<div class="tile-info-row">Elevation: <strong>${tile.elevation}</strong></div>`);
    if (tile.entry?.length) parts.push(`<div class="tile-info-row">Entry: ${tile.entry.join(', ')}</div>`);
    if (tile.walls?.length) parts.push(`<div class="tile-info-row">Walls: ${tile.walls.join(', ')}</div>`);
    if (tile.oneWayWalls?.length) {
      for (const ow of tile.oneWayWalls) {
        parts.push(`<div class="tile-info-row">
          One-way: ${ow.side} blocks ${ow.blocks}
          <button class="btn-remove-ow" data-ow-x="${x}" data-ow-y="${y}" data-ow-side="${ow.side}">\u2716</button>
        </div>`);
      }
    }
    if (tile.phases?.length) parts.push(`<div class="tile-info-row">Phases: ${tile.phases.join(', ')}</div>`);
    if (tile.group) parts.push(`<div class="tile-info-row">Group: <strong>${tile.group}</strong></div>`);
    if (tile.sideFeatures?.length) {
      for (const f of tile.sideFeatures) {
        const phaseTxt = f.phases?.length ? ` phases:[${f.phases.join(',')}]` : '';
        const strTxt = f.strength > 1 ? ` str:${f.strength}` : '';
        parts.push(`<div class="tile-info-row">
          ${f.type} on ${f.side}${strTxt}${phaseTxt}
          <button class="btn-remove-sf" data-sf-x="${x}" data-sf-y="${y}" data-sf-side="${f.side}" data-sf-type="${f.type}">\u2716</button>
        </div>`);
      }
    }
    if (tile.overlays?.length) {
      for (const o of tile.overlays) {
        const phaseTxt = o.phases?.length ? ` phases:[${o.phases.join(',')}]` : '';
        parts.push(`<div class="tile-info-row">
          ${o.type}${phaseTxt}
          <button class="btn-remove-overlay" data-ov-x="${x}" data-ov-y="${y}" data-ov-type="${o.type}">\u2716</button>
        </div>`);
      }
    }
    return `<div class="tile-info">${parts.join('')}</div>`;
  }

  function attachListeners() {
    // Tool buttons (ground tiles)
    container.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedTool = btn.dataset.tool;
        selectedSideFeature = null;
        selectedOverlay = null;
        wallMode = false;
        oneWayWallMode = false;
        selectedEntry = [];
        update();
      });
    });

    // Side feature buttons
    container.querySelectorAll('.tool-btn[data-side-feature]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedSideFeature = btn.dataset.sideFeature;
        selectedOverlay = null;
        wallMode = false;
        oneWayWallMode = false;
        update();
      });
    });

    // Overlay buttons
    container.querySelectorAll('.tool-btn[data-overlay]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedOverlay = btn.dataset.overlay;
        selectedSideFeature = null;
        wallMode = false;
        oneWayWallMode = false;
        update();
      });
    });

    // Wall mode
    container.querySelector('#wall-mode-btn')?.addEventListener('click', () => {
      wallMode = !wallMode;
      oneWayWallMode = false;
      selectedSideFeature = null;
      selectedOverlay = null;
      update();
    });

    // One-way wall mode
    container.querySelector('#oneway-wall-mode-btn')?.addEventListener('click', () => {
      oneWayWallMode = !oneWayWallMode;
      wallMode = false;
      selectedSideFeature = null;
      selectedOverlay = null;
      update();
    });

    // Blocks picker
    container.querySelectorAll('.blocks-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedBlocks = btn.dataset.blocks;
        update();
      });
    });

    // Eraser
    container.querySelector('#eraser-btn')?.addEventListener('click', () => {
      selectedTool = 'floor';
      selectedSideFeature = null;
      selectedOverlay = null;
      wallMode = false;
      oneWayWallMode = false;
      selectedEntry = [];
      update();
    });

    // Clear all
    container.querySelector('#clear-btn')?.addEventListener('click', () => {
      initTiles();
      selectedCell = null;
      update();
    });

    // Direction picker
    container.querySelectorAll('.direction-picker button').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedDirection = btn.dataset.dir;
        update();
      });
    });

    // Entry picker (multi-select toggles)
    container.querySelectorAll('.entry-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.entry;
        const idx = selectedEntry.indexOf(dir);
        if (idx >= 0) {
          selectedEntry.splice(idx, 1);
        } else {
          selectedEntry.push(dir);
        }
        update();
      });
    });

    // Strength picker
    container.querySelectorAll('.strength-picker button').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedStrength = parseInt(btn.dataset.strength);
        update();
      });
    });

    // Phase picker (multi-select toggles)
    container.querySelectorAll('.phase-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const phase = parseInt(btn.dataset.phase);
        const idx = selectedPhases.indexOf(phase);
        if (idx >= 0) {
          selectedPhases.splice(idx, 1);
        } else {
          selectedPhases.push(phase);
          selectedPhases.sort();
        }
        update();
      });
    });

    // Group picker (single-select for portal pairing)
    container.querySelectorAll('.group-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedGroup = btn.dataset.group;
        update();
      });
    });

    // Elevation picker
    container.querySelectorAll('.elevation-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedElevation = parseInt(btn.dataset.elevation);
        update();
      });
    });

    // Remove one-way wall buttons in tile info
    container.querySelectorAll('.btn-remove-ow').forEach((btn) => {
      btn.addEventListener('click', () => {
        const x = parseInt(btn.dataset.owX);
        const y = parseInt(btn.dataset.owY);
        const side = btn.dataset.owSide;
        const tile = tiles[y][x];
        if (tile.oneWayWalls) {
          tile.oneWayWalls = tile.oneWayWalls.filter((ow) => ow.side !== side);
          if (tile.oneWayWalls.length === 0) delete tile.oneWayWalls;
        }
        update();
      });
    });

    // Remove side feature buttons in tile info
    container.querySelectorAll('.btn-remove-sf').forEach((btn) => {
      btn.addEventListener('click', () => {
        const x = parseInt(btn.dataset.sfX);
        const y = parseInt(btn.dataset.sfY);
        const side = btn.dataset.sfSide;
        const type = btn.dataset.sfType;
        const tile = tiles[y][x];
        if (tile.sideFeatures) {
          tile.sideFeatures = tile.sideFeatures.filter((f) => !(f.side === side && f.type === type));
          if (tile.sideFeatures.length === 0) delete tile.sideFeatures;
        }
        update();
      });
    });

    // Remove overlay buttons in tile info
    container.querySelectorAll('.btn-remove-overlay').forEach((btn) => {
      btn.addEventListener('click', () => {
        const x = parseInt(btn.dataset.ovX);
        const y = parseInt(btn.dataset.ovY);
        const type = btn.dataset.ovType;
        const tile = tiles[y][x];
        if (tile.overlays) {
          tile.overlays = tile.overlays.filter((o) => o.type !== type);
          if (tile.overlays.length === 0) delete tile.overlays;
        }
        update();
      });
    });

    // Name/description inputs
    container.querySelector('#board-name')?.addEventListener('input', (e) => {
      boardName = e.target.value;
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

    // Right-click to select tile for info display
    grid.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const cell = e.target.closest('.editor-cell');
      if (!cell) return;
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      selectedCell = { x, y };
      update();
    });

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

    if (oneWayWallMode) {
      // Detect which edge was clicked
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
        const owWalls = tile.oneWayWalls || [];
        const existingIdx = owWalls.findIndex((ow) => ow.side === wallDir && ow.blocks === selectedBlocks);
        if (existingIdx >= 0) {
          owWalls.splice(existingIdx, 1);
        } else {
          // Remove any existing one-way wall on this side (replace blocks type)
          const sameIdx = owWalls.findIndex((ow) => ow.side === wallDir);
          if (sameIdx >= 0) owWalls.splice(sameIdx, 1);
          owWalls.push({ side: wallDir, blocks: selectedBlocks });
        }
        tiles[y][x] = { ...tile, oneWayWalls: owWalls.length > 0 ? owWalls : undefined };
        selectedCell = { x, y };
        updateCell(cell, x, y);
        update();
      }
      return;
    }

    if (selectedSideFeature) {
      // Side feature placement: detect which edge of the tile was clicked
      const rect = cell.getBoundingClientRect();
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      const w = rect.width;
      const h = rect.height;

      // Determine closest edge
      const distances = {
        north: oy,
        south: h - oy,
        west: ox,
        east: w - ox,
      };
      let side = 'north';
      let minDist = distances.north;
      for (const [dir, dist] of Object.entries(distances)) {
        if (dist < minDist) { minDist = dist; side = dir; }
      }

      const tile = tiles[y][x];
      const features = tile.sideFeatures || [];

      // Toggle: if same type+side already exists, remove it
      const existingIdx = features.findIndex((f) => f.type === selectedSideFeature && f.side === side);
      if (existingIdx >= 0) {
        features.splice(existingIdx, 1);
      } else {
        const newFeature = { type: selectedSideFeature, side };
        if (selectedSideFeature === 'laser' && selectedStrength > 1) {
          newFeature.strength = selectedStrength;
        }
        if (PHASE_ELEMENTS.has(selectedSideFeature) && selectedPhases.length > 0) {
          newFeature.phases = [...selectedPhases];
        }
        features.push(newFeature);
      }

      tiles[y][x] = { ...tile, sideFeatures: features.length > 0 ? features : undefined };
      selectedCell = { x, y };
      updateCell(cell, x, y);
      update();
      return;
    }

    if (selectedOverlay) {
      // Overlay placement: click tile to toggle overlay
      const tile = tiles[y][x];
      const overlays = tile.overlays || [];

      // Toggle: if same type already exists, remove it
      const existingIdx = overlays.findIndex((o) => o.type === selectedOverlay);
      if (existingIdx >= 0) {
        overlays.splice(existingIdx, 1);
      } else {
        const newOverlay = { type: selectedOverlay };
        if (selectedPhases.length > 0) {
          newOverlay.phases = [...selectedPhases];
        }
        overlays.push(newOverlay);
      }

      tiles[y][x] = { ...tile, overlays: overlays.length > 0 ? overlays : undefined };
      selectedCell = { x, y };
      updateCell(cell, x, y);
      update();
      return;
    }

    // Paint ground tile
    const newTile = { type: selectedTool };
    if (['conveyor', 'express_conveyor', 'current', 'ramp'].includes(selectedTool)) {
      newTile.direction = selectedDirection;
      if (['conveyor', 'express_conveyor'].includes(selectedTool) && selectedEntry.length > 0) {
        newTile.entry = [...selectedEntry];
      }
    }
    if (selectedTool === 'trap_pit' && selectedPhases.length > 0) {
      newTile.phases = [...selectedPhases];
    }
    if (selectedTool === 'portal') {
      newTile.group = selectedGroup;
    }
    if (selectedElevation > 0) {
      newTile.elevation = selectedElevation;
    }
    // Preserve existing walls, side features, and overlays
    const existing = tiles[y][x];
    if (existing.walls?.length > 0) {
      newTile.walls = existing.walls;
    }
    if (existing.sideFeatures?.length > 0) {
      newTile.sideFeatures = existing.sideFeatures;
    }
    if (existing.overlays?.length > 0) {
      newTile.overlays = existing.overlays;
    }
    if (existing.oneWayWalls?.length > 0) {
      newTile.oneWayWalls = existing.oneWayWalls;
    }
    tiles[y][x] = newTile;
    updateCell(cell, x, y);
  }

  function updateCell(cell, x, y) {
    const tile = tiles[y][x];
    cell.setAttribute('data-type', tile.type);
    cell.innerHTML = renderCellInner(tile, x, y);
  }

  function renderCellInner(tile, x, y) {
    const wallHtml = (tile.walls || []).map((w) => `<div class="wall wall-${w}"></div>`).join('');
    const owWallHtml = (tile.oneWayWalls || []).map((ow) =>
      `<div class="oneway-wall oneway-wall-${ow.side}" data-blocks="${ow.blocks}" title="one-way ${ow.side} blocks ${ow.blocks}"></div>`
    ).join('');
    const sfHtml = (tile.sideFeatures || []).map((f) => {
      const symbol = SIDE_FEATURE_SYMBOLS[f.type] || '?';
      const title = f.type + (f.phases ? ` [${f.phases.join(',')}]` : '') + (f.strength > 1 ? ` str:${f.strength}` : '');
      return `<div class="side-feature side-feature-${f.side}" data-sf-type="${f.type}" title="${title}">${symbol}</div>`;
    }).join('');
    const overlayHtml = (tile.overlays || []).map((o) => {
      const symbol = OVERLAY_SYMBOLS[o.type] || '?';
      const title = o.type + (o.phases ? ` [${o.phases.join(',')}]` : '');
      return `<div class="overlay-indicator" data-overlay-type="${o.type}" title="${title}">${symbol}</div>`;
    }).join('');
    const entryHtml = (tile.entry || []).map((d) =>
      `<div class="entry-indicator entry-${d}"></div>`
    ).join('');
    const arrow = tile.direction ? `<span class="arrow">${ARROW_MAP[tile.direction]}</span>` : '';
    const symbol = SYMBOL_MAP[tile.type] || '';
    const phaseHtml = tile.phases?.length ? `<span class="phase-dots">${tile.phases.join('')}</span>` : '';
    const groupHtml = tile.group ? `<span class="group-label">${tile.group}</span>` : '';
    const elevHtml = tile.elevation > 0 ? `<span class="elevation-badge">E${tile.elevation}</span>` : '';
    return `${wallHtml}${owWallHtml}${sfHtml}${overlayHtml}${entryHtml}${arrow || symbol}${phaseHtml}${groupHtml}${elevHtml}`;
  }

  async function handleSave() {
    if (saving) return;
    saving = true;
    error = '';
    update();

    try {
      // Clean tiles: strip undefined properties
      const cleanTiles = tiles.map((row) =>
        row.map((t) => {
          const clean = { type: t.type };
          if (t.direction) clean.direction = t.direction;
          if (t.walls && t.walls.length > 0) clean.walls = t.walls;
          if (t.entry && t.entry.length > 0) clean.entry = t.entry;
          if (t.sideFeatures && t.sideFeatures.length > 0) clean.sideFeatures = t.sideFeatures;
          if (t.overlays && t.overlays.length > 0) clean.overlays = t.overlays;
          if (t.oneWayWalls && t.oneWayWalls.length > 0) clean.oneWayWalls = t.oneWayWalls;
          if (t.phases && t.phases.length > 0) clean.phases = t.phases;
          if (t.group) clean.group = t.group;
          if (t.elevation > 0) clean.elevation = t.elevation;
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
  selectedCell = null;
  selectedSideFeature = null;
  selectedOverlay = null;
  selectedEntry = [];
  selectedElevation = 0;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
