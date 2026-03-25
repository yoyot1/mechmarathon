import '../styles/board-editor.css';
import { BOARD } from '@mechmarathon/shared';
import { api } from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import * as history from '../lib/editor/history.js';
import * as shortcuts from '../lib/editor/shortcuts.js';
import * as editorCanvas from '../lib/editor/editorCanvas.js';
import * as smartDraw from '../lib/editor/smartDraw.js';

const TYPE_LABELS = {
  floor: 'Floor', conveyor: 'Conveyor', express_conveyor: 'Express', gear_cw: 'Gear CW',
  gear_ccw: 'Gear CCW', pit: 'Pit', trap_pit: 'Trap Pit', repair: 'Repair', spawn: 'Spawn',
  oil_slick: 'Oil Slick', water: 'Water', current: 'Current',
  portal: 'Portal', drain: 'Drain', radioactive_drain: 'Rad. Drain',
  teleporter: 'Teleporter', randomizer: 'Randomizer', repulsor: 'Repulsor',
  radiation: 'Radiation', radioactive_waste: 'Rad. Waste', chop_shop: 'Chop Shop',
  ledge: 'Ledge', ramp: 'Ramp',
};

const ARROW_MAP = { north: '\u2191', south: '\u2193', east: '\u2192', west: '\u2190' };

const PORTAL_GROUPS = ['A', 'B', 'C', 'D'];

const SIDE_FEATURE_LABELS = { laser: 'Laser', pusher: 'Pusher' };
const OVERLAY_LABELS = { flamer: 'Flamer', crusher: 'Crusher' };

// Elements that need phase selection
const PHASE_ELEMENTS = new Set(['pusher', 'flamer', 'crusher', 'trap_pit']);

let tiles = [];
let boardName = '';
let boardDescription = '';
let boardId = null;
let selectedTool = null;
let selectedDirection = 'north';
let selectedSideFeature = null;
let selectedOverlay = null;
let selectedStrength = 1;
let selectedEntry = [];
let selectedPhases = [1, 3, 5];
let selectedGroup = 'A';
let selectedElevation = 0;
let wallMode = false;
let oneWayWallMode = false;
let selectedBlocks = 'entry';
let saving = false;
let error = '';
let isDragging = false;
let lastDragCell = null;
let selectedCell = null;
let lastExpandedKey = null;
let showShortcutsHelp = false;
let canvasInitialized = false;

const OPPOSITE_DIR = { north: 'south', south: 'north', east: 'west', west: 'east' };
const SMART_DRAW_TOOLS = new Set(['conveyor', 'express_conveyor']);

/** Set exit direction, swapping with entry if they collide. */
function setExitDirection(newDir) {
  const entryIdx = selectedEntry.indexOf(newDir);
  if (entryIdx >= 0) {
    selectedEntry.splice(entryIdx, 1);
    if (!selectedEntry.includes(selectedDirection)) {
      selectedEntry.push(selectedDirection);
    }
  }
  selectedDirection = newDir;
}

// Persistent DOM wrapper references (survive update() calls)
let headerWrapper = null;
let toolbarWrapper = null;
let canvasWrapper = null;
let sidebarWrapper = null;

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

function performUndo() {
  const restored = history.undo(tiles);
  if (restored) {
    tiles = restored;
    update();
  }
}

function performRedo() {
  const restored = history.redo(tiles);
  if (restored) {
    tiles = restored;
    update();
  }
}

function paintGroundTile(x, y) {
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
  if (existing.walls?.length > 0) newTile.walls = existing.walls;
  if (existing.sideFeatures?.length > 0) newTile.sideFeatures = existing.sideFeatures;
  if (existing.overlays?.length > 0) newTile.overlays = existing.overlays;
  if (existing.oneWayWalls?.length > 0) newTile.oneWayWalls = existing.oneWayWalls;
  tiles[y][x] = newTile;
  editorCanvas.updateTile(x, y, tiles);
}

// Document-level mouseup handler (stored for cleanup)
function onDocumentMouseUp() {
  if (smartDraw.isActive()) {
    const result = smartDraw.finish(tiles, selectedDirection);
    if (result?.singleClick) {
      // Fall back to normal single-click painting
      paintGroundTile(result.pos.x, result.pos.y);
    } else if (result?.applied) {
      editorCanvas.rebuildBoard(tiles);
    }
    return;
  }
  isDragging = false;
  lastDragCell = null;
}

export function render(container, params) {
  boardId = params?.id || null;
  error = '';
  saving = false;
  canvasInitialized = false;
  history.clear();

  // Build persistent layout structure once
  container.innerHTML = `
    <div class="board-editor">
      <div id="editor-header-wrapper"></div>
      <div class="board-editor-body">
        <div id="editor-toolbar-wrapper" class="editor-toolbar"></div>
        <div id="editor-canvas-wrapper" class="editor-canvas-wrapper"></div>
        <div id="editor-sidebar-wrapper" class="editor-sidebar"></div>
      </div>
    </div>
  `;

  headerWrapper = container.querySelector('#editor-header-wrapper');
  toolbarWrapper = container.querySelector('#editor-toolbar-wrapper');
  canvasWrapper = container.querySelector('#editor-canvas-wrapper');
  sidebarWrapper = container.querySelector('#editor-sidebar-wrapper');

  // Canvas event listeners (attached once, not on every update)
  canvasWrapper.addEventListener('mousedown', onCanvasMouseDown);
  canvasWrapper.addEventListener('mousemove', onCanvasMouseMove);
  canvasWrapper.addEventListener('contextmenu', onCanvasContextMenu);
  document.addEventListener('mouseup', onDocumentMouseUp);

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

  function renderElementOptions(key, category) {
    const directionHtml = `
      <span class="option-label">Direction</span>
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
      </div>`;
    const entryHtml = `
      <span class="option-label">Entry Sides <span class="help-text">(curve/merge)</span></span>
      <div class="entry-picker">
        ${['north', 'south', 'east', 'west'].map((d) => `
          <button class="entry-btn ${selectedEntry.includes(d) ? 'active' : ''}" data-entry="${d}">
            ${ARROW_MAP[d]} ${d[0].toUpperCase()}
          </button>
        `).join('')}
      </div>`;
    const phaseHtml = `
      <span class="option-label">Active Phases</span>
      <div class="phase-picker">
        ${[1, 2, 3, 4, 5].map((p) => `
          <button class="phase-btn ${selectedPhases.includes(p) ? 'active' : ''}" data-phase="${p}">${p}</button>
        `).join('')}
      </div>`;
    const strengthHtml = `
      <span class="option-label">Laser Strength</span>
      <div class="strength-picker">
        ${[1, 2, 3].map((s) => `
          <button class="${selectedStrength === s ? 'active' : ''}" data-strength="${s}">${s}</button>
        `).join('')}
      </div>`;
    const groupHtml = `
      <span class="option-label">Portal Group</span>
      <div class="group-picker">
        ${PORTAL_GROUPS.map((g) => `
          <button class="group-btn ${selectedGroup === g ? 'active' : ''}" data-group="${g}">${g}</button>
        `).join('')}
      </div>`;

    if (category === 'ground') {
      if (key === 'conveyor' || key === 'express_conveyor') return directionHtml + entryHtml;
      if (key === 'current' || key === 'ramp') return directionHtml;
      if (key === 'trap_pit') return phaseHtml;
      if (key === 'portal') return groupHtml;
    }
    if (category === 'sideFeature') {
      if (key === 'laser') return strengthHtml + phaseHtml;
      if (key === 'pusher') return phaseHtml;
    }
    if (category === 'overlay') {
      if (key === 'flamer' || key === 'crusher') return phaseHtml;
    }
    return '';
  }

  function renderShortcutsHelp() {
    const groups = shortcuts.getShortcuts();
    let html = '<div class="shortcuts-help">';
    for (const [category, items] of Object.entries(groups)) {
      html += `<div class="shortcuts-category"><h5>${category}</h5>`;
      for (const item of items) {
        html += `<div class="shortcut-row"><kbd>${item.key}</kbd><span>${item.description}</span></div>`;
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function update() {
    const canSave = boardName.length >= BOARD.NAME_MIN_LENGTH && !saving;
    const hasContent = tiles.some((row) => row.some((t) => t.type !== 'floor' || t.sideFeatures?.length || t.overlays?.length));
    const isSelectionMode = selectedTool === null && !wallMode && !oneWayWallMode && !selectedSideFeature && !selectedOverlay;
    const isGroundMode = selectedTool !== null && !wallMode && !oneWayWallMode && !selectedSideFeature && !selectedOverlay;
    const isSideFeatureMode = !!selectedSideFeature && !wallMode && !oneWayWallMode;
    const isOverlayMode = !!selectedOverlay && !wallMode && !oneWayWallMode;

    // Determine which element panel is currently expanded
    let currentExpandedKey = null;
    if (oneWayWallMode) {
      currentExpandedKey = 'tool:oneway';
    } else if (isGroundMode && renderElementOptions(selectedTool, 'ground')) {
      currentExpandedKey = `ground:${selectedTool}`;
    } else if (isSideFeatureMode && renderElementOptions(selectedSideFeature, 'sideFeature')) {
      currentExpandedKey = `sf:${selectedSideFeature}`;
    } else if (isOverlayMode && renderElementOptions(selectedOverlay, 'overlay')) {
      currentExpandedKey = `ov:${selectedOverlay}`;
    }

    const isNewExpansion = currentExpandedKey !== null && currentExpandedKey !== lastExpandedKey;
    const isCollapsing = lastExpandedKey !== null && lastExpandedKey !== currentExpandedKey;

    // Capture old panel content before re-render for simultaneous collapse
    let collapseInfo = null;
    if (isCollapsing) {
      const oldWrapper = toolbarWrapper.querySelector('.options-wrapper');
      if (oldWrapper) {
        collapseInfo = { key: lastExpandedKey, html: oldWrapper.innerHTML };
      }
    }

    lastExpandedKey = currentExpandedKey;
    const wrapperAnim = isNewExpansion ? ' expanding' : '';

    // Save toolbar scroll position before re-render
    const prevScroll = toolbarWrapper.scrollTop;

    // -- Header --
    headerWrapper.innerHTML = `
      <div class="board-editor-header">
        <h2>${boardId ? 'Edit Board' : 'New Board'}</h2>
        <div class="actions">
          <a href="/boards" data-link class="btn btn-secondary">Back</a>
          <button class="btn" id="save-btn" ${!canSave ? 'disabled' : ''}>${saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
      ${error ? `<p class="error">${error}</p>` : ''}
    `;

    // -- Canvas cursor --
    canvasWrapper.style.cursor = isSelectionMode ? 'default' : 'crosshair';

    // -- Toolbar --
    toolbarWrapper.innerHTML = `
      <button class="tool-btn select-tool-btn ${isSelectionMode ? 'active' : ''}" id="select-tool-btn">Select <kbd>V</kbd></button>
      <h4>Board Elements</h4>
      ${BOARD.TILE_TYPES.map((t) => {
        const isActive = selectedTool === t && isGroundMode;
        const opts = isActive ? renderElementOptions(t, 'ground') : '';
        return `<div class="element-item${opts ? ' has-options' : ''}">
          <button class="tool-btn ${isActive ? 'active' : ''}" data-tool="${t}">
            ${TYPE_LABELS[t] || t}
          </button>
          ${opts ? `<div class="options-wrapper${wrapperAnim}"><div class="element-options">${opts}</div></div>` : ''}
        </div>`;
      }).join('')}

      <h4>Side Features</h4>
      ${BOARD.SIDE_FEATURE_TYPES.map((t) => {
        const isActive = selectedSideFeature === t;
        const opts = isActive ? renderElementOptions(t, 'sideFeature') : '';
        return `<div class="element-item${opts ? ' has-options' : ''}">
          <button class="tool-btn ${isActive ? 'active' : ''}" data-side-feature="${t}">
            ${SIDE_FEATURE_LABELS[t] || t}
          </button>
          ${opts ? `<div class="options-wrapper${wrapperAnim}"><div class="element-options">${opts}</div></div>` : ''}
        </div>`;
      }).join('')}

      <h4>Overlays</h4>
      ${BOARD.OVERLAY_TYPES.map((t) => {
        const isActive = selectedOverlay === t;
        const opts = isActive ? renderElementOptions(t, 'overlay') : '';
        return `<div class="element-item${opts ? ' has-options' : ''}">
          <button class="tool-btn ${isActive ? 'active' : ''}" data-overlay="${t}">
            ${OVERLAY_LABELS[t] || t}
          </button>
          ${opts ? `<div class="options-wrapper${wrapperAnim}"><div class="element-options">${opts}</div></div>` : ''}
        </div>`;
      }).join('')}

      <h4>Tools</h4>
      <div class="undo-redo-row">
        <button class="tool-btn undo-btn" id="undo-btn" ${!history.canUndo() ? 'disabled' : ''} title="Undo (Ctrl+Z)">Undo</button>
        <button class="tool-btn redo-btn" id="redo-btn" ${!history.canRedo() ? 'disabled' : ''} title="Redo (Ctrl+Shift+Z)">Redo</button>
      </div>
      <button class="tool-btn ${wallMode ? 'active' : ''}" id="wall-mode-btn">Wall Mode <kbd>W</kbd></button>
      <div class="element-item${oneWayWallMode ? ' has-options' : ''}">
        <button class="tool-btn ${oneWayWallMode ? 'active' : ''}" id="oneway-wall-mode-btn">One-Way Wall</button>
        ${oneWayWallMode ? `
          <div class="options-wrapper${wrapperAnim}">
            <div class="element-options">
              <span class="option-label">Blocks</span>
              <div class="blocks-picker">
                <button class="blocks-btn ${selectedBlocks === 'entry' ? 'active' : ''}" data-blocks="entry">Entry</button>
                <button class="blocks-btn ${selectedBlocks === 'exit' ? 'active' : ''}" data-blocks="exit">Exit</button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
      <button class="tool-btn" id="eraser-btn">Eraser <kbd>E</kbd></button>
      <button class="tool-btn" id="clear-btn">Clear All</button>
      <button class="tool-btn" id="shortcuts-help-btn">${showShortcutsHelp ? 'Hide' : 'Show'} Shortcuts <kbd>?</kbd></button>
      ${showShortcutsHelp ? renderShortcutsHelp() : ''}

      ${isGroundMode ? `
        <h4>Elevation</h4>
        <div class="elevation-picker">
          ${[0, 1, 2].map((e) => `
            <button class="elevation-btn ${selectedElevation === e ? 'active' : ''}" data-elevation="${e}">${e}</button>
          `).join('')}
        </div>
      ` : ''}
    `;

    // Inject collapsing wrapper at the old element's position
    if (collapseInfo) {
      const [cat, key] = collapseInfo.key.split(':');
      let targetBtn = null;
      if (cat === 'ground') targetBtn = toolbarWrapper.querySelector(`[data-tool="${key}"]`);
      else if (cat === 'sf') targetBtn = toolbarWrapper.querySelector(`[data-side-feature="${key}"]`);
      else if (cat === 'ov') targetBtn = toolbarWrapper.querySelector(`[data-overlay="${key}"]`);
      else if (cat === 'tool') targetBtn = toolbarWrapper.querySelector('#oneway-wall-mode-btn');

      const elementItem = targetBtn?.closest('.element-item');
      if (elementItem) {
        const collapsingWrapper = document.createElement('div');
        collapsingWrapper.className = 'options-wrapper collapsing';
        collapsingWrapper.innerHTML = collapseInfo.html;
        collapsingWrapper.addEventListener('animationend', () => collapsingWrapper.remove());
        elementItem.appendChild(collapsingWrapper);
      }
    }

    // Restore toolbar scroll position
    toolbarWrapper.scrollTop = prevScroll;
    const expandedOpts = toolbarWrapper.querySelector('.options-wrapper:not(.collapsing)');
    if (expandedOpts) {
      expandedOpts.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // -- Sidebar --
    sidebarWrapper.innerHTML = `
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
    `;

    // -- Canvas (PixiJS) --
    if (!canvasInitialized) {
      canvasInitialized = true;
      editorCanvas.initEditorCanvas(canvasWrapper).then(() => {
        editorCanvas.rebuildBoard(tiles);
        if (selectedCell) editorCanvas.setSelectedCell(selectedCell.x, selectedCell.y);
      });
    } else {
      editorCanvas.rebuildBoard(tiles);
      if (selectedCell) {
        editorCanvas.setSelectedCell(selectedCell.x, selectedCell.y);
      } else {
        editorCanvas.setSelectedCell(null, null);
      }
    }

    attachToolbarSidebarListeners();
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

  function attachToolbarSidebarListeners() {
    // Select tool (pointer mode)
    toolbarWrapper.querySelector('#select-tool-btn')?.addEventListener('click', () => {
      selectedTool = null;
      selectedSideFeature = null;
      selectedOverlay = null;
      wallMode = false;
      oneWayWallMode = false;
      selectedEntry = [];
      update();
    });

    // Tool buttons (ground tiles)
    toolbarWrapper.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
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
    toolbarWrapper.querySelectorAll('.tool-btn[data-side-feature]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedSideFeature = btn.dataset.sideFeature;
        selectedOverlay = null;
        wallMode = false;
        oneWayWallMode = false;
        update();
      });
    });

    // Overlay buttons
    toolbarWrapper.querySelectorAll('.tool-btn[data-overlay]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedOverlay = btn.dataset.overlay;
        selectedSideFeature = null;
        wallMode = false;
        oneWayWallMode = false;
        update();
      });
    });

    // Wall mode
    toolbarWrapper.querySelector('#wall-mode-btn')?.addEventListener('click', () => {
      wallMode = !wallMode;
      oneWayWallMode = false;
      selectedSideFeature = null;
      selectedOverlay = null;
      update();
    });

    // One-way wall mode
    toolbarWrapper.querySelector('#oneway-wall-mode-btn')?.addEventListener('click', () => {
      oneWayWallMode = !oneWayWallMode;
      wallMode = false;
      selectedSideFeature = null;
      selectedOverlay = null;
      update();
    });

    // Blocks picker
    toolbarWrapper.querySelectorAll('.blocks-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedBlocks = btn.dataset.blocks;
        update();
      });
    });

    // Undo/Redo
    toolbarWrapper.querySelector('#undo-btn')?.addEventListener('click', performUndo);
    toolbarWrapper.querySelector('#redo-btn')?.addEventListener('click', performRedo);

    // Shortcuts help toggle
    toolbarWrapper.querySelector('#shortcuts-help-btn')?.addEventListener('click', () => {
      showShortcutsHelp = !showShortcutsHelp;
      update();
    });

    // Eraser
    toolbarWrapper.querySelector('#eraser-btn')?.addEventListener('click', () => {
      selectedTool = 'floor';
      selectedSideFeature = null;
      selectedOverlay = null;
      wallMode = false;
      oneWayWallMode = false;
      selectedEntry = [];
      update();
    });

    // Clear all
    toolbarWrapper.querySelector('#clear-btn')?.addEventListener('click', () => {
      history.push(tiles);
      initTiles();
      selectedCell = null;
      update();
    });

    // Direction picker
    toolbarWrapper.querySelectorAll('.direction-picker button').forEach((btn) => {
      btn.addEventListener('click', () => {
        setExitDirection(btn.dataset.dir);
        update();
      });
    });

    // Entry picker
    toolbarWrapper.querySelectorAll('.entry-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.entry;
        const idx = selectedEntry.indexOf(dir);
        if (idx >= 0) {
          selectedEntry.splice(idx, 1);
        } else if (dir === selectedDirection) {
          // Swap: flip exit to opposite, add this dir as entry
          selectedDirection = OPPOSITE_DIR[dir];
          // Remove new exit from entries if present
          const newExitIdx = selectedEntry.indexOf(OPPOSITE_DIR[dir]);
          if (newExitIdx >= 0) selectedEntry.splice(newExitIdx, 1);
          selectedEntry.push(dir);
        } else {
          selectedEntry.push(dir);
        }
        update();
      });
    });

    // Strength picker
    toolbarWrapper.querySelectorAll('.strength-picker button').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedStrength = parseInt(btn.dataset.strength);
        update();
      });
    });

    // Phase picker
    toolbarWrapper.querySelectorAll('.phase-btn').forEach((btn) => {
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

    // Group picker
    toolbarWrapper.querySelectorAll('.group-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedGroup = btn.dataset.group;
        update();
      });
    });

    // Elevation picker
    toolbarWrapper.querySelectorAll('.elevation-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedElevation = parseInt(btn.dataset.elevation);
        update();
      });
    });

    // Remove one-way wall buttons in tile info (sidebar)
    sidebarWrapper.querySelectorAll('.btn-remove-ow').forEach((btn) => {
      btn.addEventListener('click', () => {
        history.push(tiles);
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

    // Remove side feature buttons in tile info (sidebar)
    sidebarWrapper.querySelectorAll('.btn-remove-sf').forEach((btn) => {
      btn.addEventListener('click', () => {
        history.push(tiles);
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

    // Remove overlay buttons in tile info (sidebar)
    sidebarWrapper.querySelectorAll('.btn-remove-overlay').forEach((btn) => {
      btn.addEventListener('click', () => {
        history.push(tiles);
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

    // Name/description inputs (sidebar)
    sidebarWrapper.querySelector('#board-name')?.addEventListener('input', (e) => {
      boardName = e.target.value;
      const saveBtn = headerWrapper.querySelector('#save-btn');
      if (saveBtn) saveBtn.disabled = boardName.length < BOARD.NAME_MIN_LENGTH || saving;
    });

    sidebarWrapper.querySelector('#board-desc')?.addEventListener('input', (e) => {
      boardDescription = e.target.value;
    });

    // Save (header)
    headerWrapper.querySelector('#save-btn')?.addEventListener('click', handleSave);
  }

  // --- Canvas interaction handlers ---

  function onCanvasMouseDown(e) {
    if (e.button !== 0) return; // left click only
    const pos = editorCanvas.getGridPosition(e);
    if (!pos) return;

    // Smart draw for conveyor tools in ground mode
    const isGroundMode = selectedTool !== null && !wallMode && !oneWayWallMode && !selectedSideFeature && !selectedOverlay;
    if (isGroundMode && SMART_DRAW_TOOLS.has(selectedTool)) {
      history.push(tiles);
      smartDraw.start(pos.gridX, pos.gridY, selectedTool, tiles);
      return;
    }

    // Selection mode: select tile without modifying
    if (selectedTool === null && !wallMode && !oneWayWallMode && !selectedSideFeature && !selectedOverlay) {
      selectedCell = { x: pos.gridX, y: pos.gridY };
      update();
      return;
    }

    isDragging = true;
    lastDragCell = `${pos.gridX},${pos.gridY}`;
    history.push(tiles);
    handleCellInteractionFromPos(pos);
  }

  function onCanvasMouseMove(e) {
    const pos = editorCanvas.getGridPosition(e);
    if (pos) {
      editorCanvas.setHoverCell(pos.gridX, pos.gridY);
    } else {
      editorCanvas.setHoverCell(null, null);
    }

    // Smart draw path extension
    if (smartDraw.isActive() && pos) {
      const result = smartDraw.extend(pos.gridX, pos.gridY, tiles, BOARD.SIZE);
      if (result.applied) {
        editorCanvas.rebuildBoard(tiles);
      }
      return;
    }

    if (!isDragging || !pos) return;
    const cellKey = `${pos.gridX},${pos.gridY}`;
    if (cellKey === lastDragCell) return;
    lastDragCell = cellKey;
    handleCellInteractionFromPos(pos);
  }

  function onCanvasContextMenu(e) {
    e.preventDefault();
    const pos = editorCanvas.getGridPosition(e);
    if (!pos) return;
    selectedCell = { x: pos.gridX, y: pos.gridY };
    update();
  }

  function handleCellInteractionFromPos(pos) {
    const { gridX: x, gridY: y, offsetX, offsetY, cellW, cellH } = pos;

    if (wallMode) {
      const threshold = cellW * 0.2;
      let wallDir = null;
      if (offsetY < threshold) wallDir = 'north';
      else if (offsetY > cellH - threshold) wallDir = 'south';
      else if (offsetX < threshold) wallDir = 'west';
      else if (offsetX > cellW - threshold) wallDir = 'east';

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
        editorCanvas.rebuildBoard(tiles);
      }
      return;
    }

    if (oneWayWallMode) {
      const threshold = cellW * 0.2;
      let wallDir = null;
      if (offsetY < threshold) wallDir = 'north';
      else if (offsetY > cellH - threshold) wallDir = 'south';
      else if (offsetX < threshold) wallDir = 'west';
      else if (offsetX > cellW - threshold) wallDir = 'east';

      if (wallDir) {
        const tile = tiles[y][x];
        const owWalls = tile.oneWayWalls || [];
        const existingIdx = owWalls.findIndex((ow) => ow.side === wallDir && ow.blocks === selectedBlocks);
        if (existingIdx >= 0) {
          owWalls.splice(existingIdx, 1);
        } else {
          const sameIdx = owWalls.findIndex((ow) => ow.side === wallDir);
          if (sameIdx >= 0) owWalls.splice(sameIdx, 1);
          owWalls.push({ side: wallDir, blocks: selectedBlocks });
        }
        tiles[y][x] = { ...tile, oneWayWalls: owWalls.length > 0 ? owWalls : undefined };
        selectedCell = { x, y };
        update();
      }
      return;
    }

    if (selectedSideFeature) {
      const distances = {
        north: offsetY,
        south: cellH - offsetY,
        west: offsetX,
        east: cellW - offsetX,
      };
      let side = 'north';
      let minDist = distances.north;
      for (const [dir, dist] of Object.entries(distances)) {
        if (dist < minDist) { minDist = dist; side = dir; }
      }

      const tile = tiles[y][x];
      const features = tile.sideFeatures || [];
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
      update();
      return;
    }

    if (selectedOverlay) {
      const tile = tiles[y][x];
      const overlays = tile.overlays || [];
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
      update();
      return;
    }

    if (selectedTool === null) {
      selectedCell = { x, y };
      update();
    } else {
      paintGroundTile(x, y);
    }
  }

  async function handleSave() {
    if (saving) return;
    saving = true;
    error = '';
    update();

    try {
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

  // Register keyboard shortcuts
  shortcuts.unregisterAll();

  shortcuts.register('ctrl+z', performUndo, 'Undo', 'Editing');
  shortcuts.register('ctrl+shift+z', performRedo, 'Redo', 'Editing');
  shortcuts.register('Escape', () => {
    if (smartDraw.isActive()) {
      smartDraw.cancel();
      // Restore from undo stack (undo the in-progress drag)
      const restored = history.undo(tiles);
      if (restored) tiles = restored;
      editorCanvas.rebuildBoard(tiles);
      return;
    }
    selectedTool = null;
    selectedSideFeature = null;
    selectedOverlay = null;
    wallMode = false;
    oneWayWallMode = false;
    selectedEntry = [];
    update();
  }, 'Deselect tool / cancel drag', 'Editing');
  shortcuts.register('w', () => {
    wallMode = !wallMode;
    oneWayWallMode = false;
    selectedSideFeature = null;
    selectedOverlay = null;
    update();
  }, 'Wall mode', 'Tools');
  shortcuts.register('e', () => {
    selectedTool = 'floor';
    selectedSideFeature = null;
    selectedOverlay = null;
    wallMode = false;
    oneWayWallMode = false;
    selectedEntry = [];
    update();
  }, 'Eraser', 'Tools');
  shortcuts.register('v', () => {
    selectedTool = null;
    selectedSideFeature = null;
    selectedOverlay = null;
    wallMode = false;
    oneWayWallMode = false;
    selectedEntry = [];
    update();
  }, 'Select (pointer)', 'Tools');

  // Arrow keys for direction picker
  shortcuts.register('ArrowUp', () => { setExitDirection('north'); update(); }, 'Direction: North', 'Direction');
  shortcuts.register('ArrowDown', () => { setExitDirection('south'); update(); }, 'Direction: South', 'Direction');
  shortcuts.register('ArrowRight', () => { setExitDirection('east'); update(); }, 'Direction: East', 'Direction');
  shortcuts.register('ArrowLeft', () => { setExitDirection('west'); update(); }, 'Direction: West', 'Direction');

  // Number keys for quick tile selection
  const tileKeys = BOARD.TILE_TYPES.slice(0, 9);
  tileKeys.forEach((t, i) => {
    shortcuts.register(String(i + 1), () => {
      selectedTool = t;
      selectedSideFeature = null;
      selectedOverlay = null;
      wallMode = false;
      oneWayWallMode = false;
      selectedEntry = [];
      update();
    }, TYPE_LABELS[t] || t, 'Tile Types');
  });

  shortcuts.register('shift+?', () => {
    showShortcutsHelp = !showShortcutsHelp;
    update();
  }, 'Toggle shortcuts help', 'Other');

  update();
}

export function unmount() {
  smartDraw.cancel();
  editorCanvas.destroyEditorCanvas();
  document.removeEventListener('mouseup', onDocumentMouseUp);
  boardId = null;
  boardName = '';
  boardDescription = '';
  tiles = [];
  isDragging = false;
  lastDragCell = null;
  selectedTool = null;
  selectedCell = null;
  selectedSideFeature = null;
  selectedOverlay = null;
  selectedEntry = [];
  selectedElevation = 0;
  lastExpandedKey = null;
  showShortcutsHelp = false;
  canvasInitialized = false;
  headerWrapper = null;
  toolbarWrapper = null;
  canvasWrapper = null;
  sidebarWrapper = null;
  history.clear();
  shortcuts.unregisterAll();
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
