import '../styles/board-library.css';
import { api } from '../lib/api.js';
import { auth } from '../state/auth.js';
import { navigateTo } from '../lib/router.js';

let activeTab = 'official';
let boards = [];
let myBoards = [];
let loading = false;
let error = '';

export function render(container) {
  loadBoards();

  async function loadBoards() {
    loading = true;
    error = '';
    update();

    try {
      const [allBoards, mine] = await Promise.all([
        api('/api/boards'),
        api('/api/boards/mine'),
      ]);
      boards = allBoards;
      myBoards = mine;
    } catch (e) {
      error = e.message;
    }

    loading = false;
    update();
  }

  function getFilteredBoards() {
    if (activeTab === 'official') return boards.filter((b) => b.isOfficial);
    if (activeTab === 'community') return boards.filter((b) => !b.isOfficial);
    return myBoards;
  }

  function update() {
    const userId = auth.user?.id;
    const filtered = getFilteredBoards();

    container.innerHTML = `
      <div class="board-library">
        <div class="board-library-header">
          <h2>Board Library</h2>
          <div>
            <a href="/lobby" data-link class="btn btn-secondary btn-small">Back to Lobbies</a>
            <a href="/boards/new" data-link class="btn btn-small">Create Board</a>
          </div>
        </div>

        <div class="tabs">
          <button class="tab-btn ${activeTab === 'official' ? 'active' : ''}" data-tab="official">Official</button>
          <button class="tab-btn ${activeTab === 'community' ? 'active' : ''}" data-tab="community">Community</button>
          <button class="tab-btn ${activeTab === 'mine' ? 'active' : ''}" data-tab="mine">My Boards</button>
        </div>

        ${loading ? '<div class="loading">Loading boards...</div>' :
          error ? `<p class="error" style="color:#ff4444">${error}</p>` :
          filtered.length === 0 ? `<div class="empty"><p>${activeTab === 'mine' ? 'You haven\'t created any boards yet.' : 'No boards available.'}</p></div>` : `
          <div class="board-grid">
            ${filtered.map((b) => `
              <div class="board-card">
                <div>
                  <h3>${escapeHtml(b.name)}</h3>
                  ${b.isOfficial ? '<span class="badge badge-official">Official</span>' : ''}
                  ${b.isPublished ? '<span class="badge">Published</span>' : ''}
                </div>
                ${b.description ? `<div class="board-description">${escapeHtml(b.description)}</div>` : ''}
                <div class="board-meta">
                  ${b.author?.username ? `by ${escapeHtml(b.author.username)}` : ''}
                </div>
                <div class="board-actions">
                  ${b.authorId === userId && !b.isOfficial ? `
                    <a href="/boards/edit/${b.id}" data-link class="btn btn-small btn-secondary">Edit</a>
                    <button class="btn btn-small delete-board-btn" data-id="${b.id}">Delete</button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    // Tab buttons
    container.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        update();
      });
    });

    // Delete buttons
    container.querySelectorAll('.delete-board-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this board?')) return;
        try {
          await api(`/api/boards/${btn.dataset.id}`, { method: 'DELETE' });
          await loadBoards();
        } catch (e) {
          error = e.message;
          update();
        }
      });
    });
  }

  update();
}

export function unmount() {
  activeTab = 'official';
  boards = [];
  myBoards = [];
  loading = false;
  error = '';
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
