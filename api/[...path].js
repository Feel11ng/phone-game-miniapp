// Catch-all mock API for Vercel serverless (Telegram Mini App demo)
// Endpoints:
//  GET  /api/user
//  GET  /api/inventory    (alias: /api/user/inventory)
//  GET  /api/cases
//  POST /api/cases/open   { caseId }
//  GET  /api/market
//  POST /api/logs, /api/logs/error

module.exports = async (req, res) => {
  const send = (status, data, extra = {}) => {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...extra
    };
    res.statusCode = status;
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end(JSON.stringify(data));
  };
  const ok = (data) => send(200, data);
  const noContent = () => { res.statusCode = 204; res.setHeader('Access-Control-Allow-Origin', '*'); res.end(); };
  const parseBody = () => new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
  });
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (req.method === 'OPTIONS') return noContent();

  const url = new URL(req.url, 'http://localhost');
  const path = (url.pathname.startsWith('/api') ? url.pathname.slice(4) : url.pathname).replace(/^\/+/, '');
  const seg = path.split('/').filter(Boolean);

  const mockUser = { id: 10001, firstName: 'Игрок', username: 'player1', photoUrl: null, signals: 750 };
  const mockInventory = [
    { id: 'p1', name: 'iPhone 14 Pro', rarity: 'epic', image: 'https://via.placeholder.com/120?text=iPhone14Pro' },
    { id: 'p2', name: 'Samsung Galaxy S23', rarity: 'rare', image: 'https://via.placeholder.com/120?text=S23' },
    { id: 'p3', name: 'Google Pixel 7', rarity: 'uncommon', image: 'https://via.placeholder.com/120?text=Pixel7' }
  ];
  const mockCases = [
    { id: 1, name: 'Базовый кейс', price: 50, image: 'https://via.placeholder.com/120?text=Case1',
      pool: [
        { id: 'ip13', name: 'iPhone 13', rarity: 'uncommon', image: 'https://via.placeholder.com/300?text=iPhone13' },
        { id: 'mi12', name: 'Xiaomi 12', rarity: 'common', image: 'https://via.placeholder.com/300?text=Xiaomi12' },
        { id: 'px6', name: 'Google Pixel 6', rarity: 'rare', image: 'https://via.placeholder.com/300?text=Pixel6' }
      ] },
    { id: 2, name: 'Премиум кейс', price: 200, image: 'https://via.placeholder.com/120?text=Case2',
      pool: [
        { id: 'ip15pm', name: 'iPhone 15 Pro Max', rarity: 'legendary', image: 'https://via.placeholder.com/300?text=15+Pro+Max' },
        { id: 's23u', name: 'Samsung S23 Ultra', rarity: 'epic', image: 'https://via.placeholder.com/300?text=S23+Ultra' },
        { id: 'px8p', name: 'Pixel 8 Pro', rarity: 'rare', image: 'https://via.placeholder.com/300?text=Pixel+8+Pro' }
      ] }
  ];
  const mockMarket = [
    { id: 101, name: 'iPhone 15 Pro Max', price: 500, seller: 'User123', rarity: 'legendary' },
    { id: 102, name: 'Samsung Galaxy S23', price: 450, seller: 'Trader22', rarity: 'rare' },
    { id: 103, name: 'Google Pixel 8 Pro', price: 400, seller: 'PhoneLover', rarity: 'rare' },
    { id: 104, name: 'Xiaomi 13T Pro', price: 350, seller: 'TechGuru', rarity: 'uncommon' }
  ];

  try {
    if (req.method === 'GET' && (path === 'user' || path === 'user/')) return ok({ ok: true, user: mockUser });
    if (req.method === 'GET' && (path === 'inventory' || path === 'user/inventory')) return ok({ ok: true, inventory: mockInventory });
    if (req.method === 'GET' && (path === 'cases' || path === 'cases/')) return ok({ ok: true, cases: mockCases });
    if (req.method === 'POST' && seg[0] === 'cases' && seg[1] === 'open') {
      const body = await parseBody();
      const caseId = Number(body.caseId || body.id) || mockCases[0].id;
      const found = mockCases.find(c => c.id === caseId) || mockCases[0];
      const prize = pick(found.pool);
      return ok({ ok: true, prize, newBalance: Math.max(0, (mockUser.signals || 0) - (found.price || 0)) });
    }
    if (req.method === 'GET' && (path === 'market' || path === 'market/')) return ok({ ok: true, items: mockMarket });
    if (req.method === 'POST' && seg[0] === 'logs') return ok({ ok: true });
    return send(404, { ok: false, error: 'Not Found', path: `/${path}` });
  } catch (e) {
    console.error('API error', e);
    return send(500, { ok: false, error: 'Internal Server Error' });
  }
};
