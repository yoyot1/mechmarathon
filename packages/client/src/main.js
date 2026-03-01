import './styles/global.css';
import { createRouter } from './lib/router.js';
import { auth } from './state/auth.js';

const routes = [
  {
    path: '/',
    view: () => import('./views/home.js'),
    meta: { guest: true },
  },
  {
    path: '/login',
    view: () => import('./views/login.js'),
    meta: { guest: true },
  },
  {
    path: '/register',
    view: () => import('./views/register.js'),
    meta: { guest: true },
  },
  {
    path: '/lobby',
    view: () => import('./views/lobbyList.js'),
    meta: { requiresAuth: true },
  },
  {
    path: '/lobby/:id',
    view: () => import('./views/lobby.js'),
    meta: { requiresAuth: true },
  },
  {
    path: '/game/:id',
    view: () => import('./views/game.js'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter(routes, {
  beforeEach(route) {
    // Redirect unauthenticated users away from protected routes
    if (route.meta?.requiresAuth && !auth.user) {
      return '/login';
    }
    // Redirect authenticated users away from guest-only pages
    if (route.meta?.guest && auth.user) {
      return '/lobby';
    }
    return null;
  },
});

auth.init().then(() => {
  router.start();
});
