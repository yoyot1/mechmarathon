/**
 * Keyboard shortcut framework for the board editor.
 *
 * register(key, handler, description, category)
 *   - key: shortcut string, e.g. 'ctrl+z', 'shift+?', 'w', 'ArrowUp'
 *     Modifiers: ctrl (maps to Cmd on Mac), shift, alt
 *     Key names are case-insensitive for letters, exact for special keys.
 *   - handler: function called when shortcut fires
 *   - description: human-readable label for the help panel
 *   - category: grouping label (e.g. 'Editing', 'Tools', 'Tile Types')
 *
 * unregisterAll() — removes the global listener, clears all shortcuts
 */

let shortcuts = [];
let listening = false;
let onChangeCallback = null;

function normalizeKey(raw) {
  const parts = raw.toLowerCase().split('+').map((p) => p.trim());
  const mods = { ctrl: false, shift: false, alt: false };
  let key = '';
  for (const p of parts) {
    if (p === 'ctrl' || p === 'cmd' || p === 'meta') mods.ctrl = true;
    else if (p === 'shift') mods.shift = true;
    else if (p === 'alt') mods.alt = true;
    else key = p;
  }
  return { key, ...mods };
}

function handleKeydown(e) {
  // Ignore shortcuts when focused on input/textarea
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const alt = e.altKey;
  const pressed = e.key.toLowerCase();

  for (const shortcut of shortcuts) {
    const n = shortcut.normalized;
    if (n.ctrl !== ctrl) continue;
    if (n.shift !== shift) continue;
    if (n.alt !== alt) continue;

    // Match key — compare lowercase. For special keys like ArrowUp, compare both.
    if (n.key === pressed || n.key === e.code.toLowerCase()) {
      e.preventDefault();
      shortcut.handler();
      return;
    }
  }
}

export function register(key, handler, description, category) {
  shortcuts.push({
    raw: key,
    normalized: normalizeKey(key),
    handler,
    description,
    category,
  });

  if (!listening) {
    document.addEventListener('keydown', handleKeydown);
    listening = true;
  }

  if (onChangeCallback) onChangeCallback();
}

export function unregisterAll() {
  shortcuts = [];
  if (listening) {
    document.removeEventListener('keydown', handleKeydown);
    listening = false;
  }
  onChangeCallback = null;
}

/** Set a callback that fires whenever the shortcut list changes. */
export function onChange(cb) {
  onChangeCallback = cb;
}

/** Get all registered shortcuts grouped by category. */
export function getShortcuts() {
  const groups = {};
  for (const s of shortcuts) {
    const cat = s.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ key: s.raw, description: s.description });
  }
  return groups;
}
