const API_BASE = 'https://v3.football.api-sports.io';

const ROUTES = {
  leagues: { path: '/leagues', allowed: ['id', 'name', 'country', 'code', 'season', 'team', 'type', 'current', 'search', 'last'] },
  teams: { path: '/teams', allowed: ['id', 'name', 'league', 'season', 'country', 'code', 'venue', 'search'] },
  fixtures: { path: '/fixtures', allowed: ['id', 'ids', 'live', 'date', 'league', 'season', 'team', 'last', 'next', 'from', 'to', 'round', 'status', 'venue', 'timezone'] },
  events: { path: '/fixtures/events', allowed: ['fixture', 'team', 'player', 'type'] },
  statistics: { path: '/fixtures/statistics', allowed: ['fixture', 'team', 'type', 'half'] },
  odds: { path: '/odds', allowed: ['fixture', 'league', 'season', 'date', 'timezone', 'page', 'bookmaker', 'bet'] },
  liveOdds: { path: '/odds/live', allowed: ['fixture', 'league', 'bet'] }
};
const REQUIRED = { teams: ['league', 'season'], events: ['fixture'], statistics: ['fixture'] };

function json(statusCode, body, headers = {}) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }, body: JSON.stringify(body) };
}

export const handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowedOrigins = new Set([
    process.env.APP_ORIGIN,
    'capacitor://localhost',
    'http://localhost',
    'https://localhost'
  ].filter(Boolean));
  if (origin && !allowedOrigins.has(origin)) return json(403, { error: 'Origin tidak diizinkan.' });

  const cors = origin ? {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  } : {};

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method tidak diizinkan.' }, cors);

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return json(503, { error: 'API belum dikonfigurasi. Atur API_FOOTBALL_KEY di environment Netlify.' }, cors);

  const params = event.queryStringParameters || {};
  const action = params.action || '';
  const route = ROUTES[action];
  if (!route) return json(400, { error: 'Action tidak dikenal.', allowed: Object.keys(ROUTES) }, cors);

  const upstreamUrl = new URL(API_BASE + route.path);
  for (const [key, value] of Object.entries(params)) {
    if (key === 'action' || value == null || value === '') continue;
    if (!route.allowed.includes(key)) return json(400, { error: 'Parameter tidak diizinkan: ' + key }, cors);
    if (String(value).length > 120) return json(400, { error: 'Parameter terlalu panjang: ' + key }, cors);
    upstreamUrl.searchParams.set(key, String(value));
  }

  for (const key of REQUIRED[action] || []) {
    if (!upstreamUrl.searchParams.has(key)) return json(400, { error: 'Parameter wajib: ' + key }, cors);
  }
  if (action === 'fixtures' && !['date', 'league', 'team', 'live', 'id', 'last', 'next', 'from'].some(k => upstreamUrl.searchParams.has(k))) {
    return json(400, { error: 'Pilih filter jadwal: date, league, team, live, id, last, next, atau from.' }, cors);
  }
  if (action === 'odds' && !['fixture', 'league', 'date'].some(k => upstreamUrl.searchParams.has(k))) {
    return json(400, { error: 'Odds perlu filter fixture, league, atau date.' }, cors);
  }

  try {
    const upstream = await fetch(upstreamUrl, { headers: { 'x-apisports-key': apiKey, Accept: 'application/json' } });
    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch { return json(502, { error: 'Respons penyedia data tidak valid.' }, cors); }
    const cacheSeconds = ['fixtures', 'events', 'liveOdds'].includes(action) ? 20
      : action === 'statistics' ? 45 : action === 'odds' ? 300 : 3600;
    return {
      statusCode: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=' + cacheSeconds, 'X-FAL-Provider': 'API-Football' },
      body: JSON.stringify(data)
    };
  } catch {
    return json(502, { error: 'Tidak dapat terhubung ke API-Football. Coba lagi nanti.' }, cors);
  }
};
