/** Minimal History API router */

let routes = [];
let currentView = null;
let beforeEachGuard = null;

export function createRouter(routeDefs, options = {}) {
  routes = routeDefs;
  if (options.beforeEach) beforeEachGuard = options.beforeEach;

  return { navigateTo, start, getCurrentParams };
}

let currentParams = {};

function getCurrentParams() {
  return currentParams;
}

function matchRoute(path) {
  for (const route of routes) {
    const paramNames = [];
    const pattern = route.path.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${pattern}$`);
    const match = path.match(regex);
    if (match) {
      const params = {};
      paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
      return { route, params };
    }
  }
  return null;
}

async function renderRoute(path) {
  const result = matchRoute(path);
  if (!result) {
    document.getElementById('app').innerHTML = '<h1>404 - Not Found</h1>';
    return;
  }

  const { route, params } = result;

  // Run guard
  if (beforeEachGuard) {
    const redirect = beforeEachGuard(route, params);
    if (redirect) {
      navigateTo(redirect);
      return;
    }
  }

  // Unmount previous view
  if (currentView && currentView.unmount) {
    currentView.unmount();
  }

  currentParams = params;

  // Load and render view
  const viewModule = typeof route.view === 'function' ? await route.view() : route.view;
  currentView = viewModule;
  const container = document.getElementById('app');
  container.innerHTML = '';
  viewModule.render(container, params);
}

export function navigateTo(path) {
  history.pushState(null, '', path);
  renderRoute(path);
}

function start() {
  // Listen for popstate (back/forward)
  window.addEventListener('popstate', () => {
    renderRoute(location.pathname);
  });

  // Intercept link clicks with data-link attribute
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-link]');
    if (link) {
      e.preventDefault();
      navigateTo(link.getAttribute('href'));
    }
  });

  // Render initial route
  renderRoute(location.pathname);
}
