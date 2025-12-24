// Vercel serverless function: catch-all API for mock backend
// Supports endpoints:
//  - GET  /api/user
//  - GET  /api/user/inventory  (alias of /api/inventory)
//  - GET  /api/inventory
//  - GET  /api/cases
//  - POST /api/cases/open
//  - GET  /api/market
//  - POST /api/logs
//  - POST /api/logs/error

function sendJSON(res, status, data, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders,
  };
  res.statusCode = status;
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(data));
}

function sendNoContent(res) {
  res.statusCode = 204;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end();
}

function ok(res, data) {
  sendJSON(res, 200, data);
}

async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_) {
        resolve({});
      }
    });
  });
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Mock data
const mockUser = {
  id: 10001,
  firstName: 'Игрок',
  username: 'player1',
  photoUrl: null,
  signals: 750,
};

const mockInventory = [
  { id: 'p1', name: 'iPhone 14 Pro', rarity: 'epic', image: 'https://via.placeholder.com/120?text=iPhone14Pro' },
  { id: 'p2', name: 'Samsung Galaxy S23', rarity: 'rare', image: 'https://via.placeholder.com/120?text=S23' },
  { id: 'p3', name: 'Google Pixel 7', rarity: 'uncommon', image: 'https://via.placeholder.com/120?text=Pixel7' },
];

const mockCases = [
  {
    id: 1,
    name: 'Базовый кейс',
    price: 50,
    image: 'https://via.placeholder.com/120?text=Case1',
    pool: [
      { id: 'ip13', name: 'iPhone 13', rarity: 'uncommon', image: 'https://via.placeholder.com/300?text=iPhone13' },
      { id: 'mi12', name: 'Xiaomi 12', rarity: 'common', image: 'https://via.placeholder.com/300?text=Xiaomi12' },
      { id: 'px6', name: 'Google Pixel 6', rarity: 'rare', image: 'https://via.placeholder.com/300?text=Pixel6' },
    ],
  },
  {
    id: 2,
    name: 'Премиум кейс',
    price: 200,
    image: 'https://via.placeholder.com/120?text=Case2',
    pool: [
      { id: 'ip15pm', name: 'iPhone 15 Pro Max', rarity: 'legendary', image: 'https://via.placeholder.com/300?text=15+Pro+Max' },
      { id: 's23u', name: 'Samsung S23 Ultra', rarity: 'epic', image: 'https://via.placeholder.com/300?text=S23+Ultra' },
      { id: 'px8p', name: 'Pixel 8 Pro', rarity: 'rare', image: 'https://via.placeholder.com/300?text=Pixel+8+Pro' },
    ],
  },
];

const mockMarket = [
  { id: 101, name: 'iPhone 15 Pro Max', price: 500, seller: 'User123', rarity: 'legendary' },
  { id: 102, name: 'Samsung Galaxy S23', price: 450, seller: 'Trader22', rarity: 'rare' },
  { id: 103, name: 'Google Pixel 8 Pro', price: 400, seller: 'PhoneLover', rarity: 'rare' },
  { id: 104, name: 'Xiaomi 13T Pro', price: 350, seller: 'TechGuru', rarity: 'uncommon' },
];

function stripApiPrefix(pathname) {
  // Removes leading "/api" if present
  return pathname.startsWith('/api') ? pathname.slice(4) || '/' : pathname;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendNoContent(res);
  }

  const url = new URL(req.url, 'http://localhost');
  const rawPath = stripApiPrefix(url.pathname);
  const path = rawPath.replace(/^\/+/, ''); // remove leading slashes
  const segments = path.split('/').filter(Boolean); // ["user"], ["cases","open"], etc.

  try {
    // GET /api/user
    if (req.method === 'GET' && (path === 'user' || path === 'user/')) {
      return ok(res, { ok: true, user: mockUser });
    }

    // GET /api/inventory and alias /api/user/inventory
    if (req.method === 'GET' && (path === 'inventory' || path === 'user/inventory')) {
      return ok(res, { ok: true, inventory: mockInventory });
    }

    // GET /api/cases
    if (req.method === 'GET' && (path === 'cases' || path === 'cases/')) {
      return ok(res, { ok: true, cases: mockCases });
    }

    // POST /api/cases/open
    if (req.method === 'POST' && segments[0] === 'cases' && segments[1] === 'open') {
      const body = await parseBody(req);
      const caseId = Number(body.caseId || body.id);
      const found = mockCases.find((c) => c.id === caseId) || mockCases[0];
      const prize = pickRandom(found.pool);
      const response = {
        ok: true,
        prize,
        newBalance: Math.max(0, (mockUser.signals || 0) - (found.price || 0)),
      };
      return ok(res, response);
    }

    // GET /api/market
    if (req.method === 'GET' && (path === 'market' || path === 'market/')) {
      return ok(res, { ok: true, items: mockMarket });
    }

    // POST /api/logs and /api/logs/error
    if (req.method === 'POST' && (segments[0] === 'logs')) {
      const body = await parseBody(req);
      // You can forward this to a real logging service here
      return ok(res, { ok: true });
    }

    // Fallback 404 JSON
    return sendJSON(res, 404, { ok: false, error: 'Not Found', path: `/${path}` });
  } catch (error) {
    console.error('API error:', error);
    return sendJSON(res, 500, { ok: false, error: 'Internal Server Error' });
  }
};
