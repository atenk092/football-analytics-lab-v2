import React, { useMemo, useState } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

const API_BASE = 'https://v3.football.api-sports.io';
const API_PATHS = {
  leagues: '/leagues',
  teams: '/teams',
  fixtures: '/fixtures',
  events: '/fixtures/events',
  statistics: '/fixtures/statistics',
  odds: '/odds',
  liveOdds: '/odds/live'
};

export default function ApiData({ onTeamsLoaded, onSelectTeams }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('fal_api_football_key') || '');
  const [keyDraft, setKeyDraft] = useState(() => localStorage.getItem('fal_api_football_key') || '');
  const [keySaved, setKeySaved] = useState(!!localStorage.getItem('fal_api_football_key'));
  const [search, setSearch] = useState('Premier League');
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [leagueId, setLeagueId] = useState('');
  const [leagues, setLeagues] = useState([]);
  const [teams, setTeams] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fixtures, setFixtures] = useState([]);
  const [live, setLive] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function saveApiKey() {
    const clean = keyDraft.trim();
    if (!clean) { setError('Masukkan API key terlebih dahulu.'); return; }
    localStorage.setItem('fal_api_football_key', clean);
    setApiKey(clean);
    setKeySaved(true);
    setError('');
    setMessage('API key tersimpan di perangkat ini.');
  }

  function clearApiKey() {
    localStorage.removeItem('fal_api_football_key');
    setApiKey('');
    setKeyDraft('');
    setKeySaved(false);
    setMessage('API key lokal dihapus dari perangkat ini.');
  }

  async function call(action, params = {}) {
    if (!apiKey) throw new Error('Masukkan dan simpan API key API-Football terlebih dahulu.');
    const path = API_PATHS[action];
    if (!path) throw new Error('Endpoint API tidak dikenal.');
    const url = new URL(API_BASE + path);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) url.searchParams.set(key, String(value));
    });
    const headers = { Accept: 'application/json', 'x-apisports-key': apiKey };
    let response;
    if (Capacitor.isNativePlatform()) {
      response = await CapacitorHttp.get({ url: url.toString(), headers });
    } else {
      response = await fetch(url.toString(), { headers });
      response = { status: response.status, data: await response.json() };
    }
    const data = response.data;
    if (response.status < 200 || response.status >= 300 || data?.errors && Object.keys(data.errors).length) {
      const detail = data?.message || data?.error || Object.values(data?.errors || {}).filter(Boolean).join(', ') || ('HTTP ' + response.status);
      throw new Error(detail);
    }
    return data;
  }

  async function findLeagues() {
    setBusy('leagues'); setError(''); setMessage('');
    try {
      const data = await call('leagues', { search: search.trim(), season });
      const rows = data.response || [];
      setLeagues(rows);
      setLeagueId(rows[0]?.league?.id ? String(rows[0].league.id) : '');
      setMessage(rows.length ? rows.length + ' kompetisi ditemukan.' : 'Kompetisi tidak ditemukan pada musim tersebut.');
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }

  async function loadTeams() {
    if (!leagueId) { setError('Cari dan pilih kompetisi terlebih dahulu.'); return; }
    setBusy('teams'); setError(''); setMessage('');
    try {
      const data = await call('teams', { league: leagueId, season });
      const rows = data.response || [];
      const names = rows.map(x => x.team?.name).filter(Boolean);
      setTeams(names); onTeamsLoaded?.(names);
      setMessage(names.length + ' tim berhasil dimuat ke pilihan Match Analysis.');
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }

  async function loadFixtures() {
    if (!leagueId) { setError('Pilih kompetisi terlebih dahulu.'); return; }
    setBusy('fixtures'); setError(''); setMessage('');
    try {
      const data = await call('fixtures', { league: leagueId, season, date, timezone: 'Asia/Jakarta' });
      const rows = data.response || [];
      setFixtures(rows);
      setMessage(rows.length + ' pertandingan ditemukan untuk tanggal tersebut.');
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }

  async function loadLive() {
    setBusy('live'); setError(''); setMessage('');
    try {
      const data = await call('fixtures', { live: 'all', timezone: 'Asia/Jakarta' });
      const rows = data.response || [];
      setLive(rows);
      setMessage(rows.length + ' pertandingan live ditemukan.');
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }

  const selectedLeague = useMemo(() => leagues.find(x => String(x.league?.id) === leagueId), [leagues, leagueId]);
  const useFixture = (fixture) => {
    const h = fixture.teams?.home?.name, a = fixture.teams?.away?.name;
    if (h && a) onSelectTeams?.(h, a);
  };
  const status = x => x.fixture?.status?.short === 'NS' ? new Date(x.fixture.date).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : (x.fixture?.status?.long || x.fixture?.status?.short || '—');

  return <section className="panel">
    <div className="panel-head"><div><div className="eyebrow">LIVE DATA PROVIDER</div><h3>API-Football connection</h3></div><span className="tag">ANDROID DIRECT API</span></div>
    <p className="muted">Aplikasi Android menghubungi API-Football langsung. API key disimpan lokal di perangkat dan tidak perlu Netlify.</p>
    <div className="form-grid">
      <label className="field"><span>API-FOOTBALL API KEY</span><input type="password" autoComplete="off" value={keyDraft} onChange={e=>{setKeyDraft(e.target.value);setKeySaved(false);}} placeholder="Tempel API key dari dashboard"/></label>
      <div className="field"><span>STATUS KEY</span><small>{keySaved && apiKey ? 'Tersimpan di perangkat ini' : 'Belum tersimpan'}</small><div className="button-row"><button className="primary" onClick={saveApiKey}>Simpan key</button>{keySaved&&<button className="secondary" onClick={clearApiKey}>Hapus</button>}</div></div>
    </div>
    <div className="disclaimer">PENTING: key tersimpan di penyimpanan lokal aplikasi, bukan penyimpanan terenkripsi. Jangan bagikan APK yang berisi key, dan jangan commit key ke GitHub. Khusus pemakaian pribadi. Request Android memakai native HTTP Capacitor untuk menghindari batasan CORS WebView.</div>
    <div className="form-grid">
      <label className="field"><span>CARI KOMPETISI</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Premier League, La Liga..."/></label>
      <label className="field"><span>MUSIM (TAHUN)</span><input type="number" min="2000" max="2100" value={season} onChange={e=>setSeason(e.target.value)}/></label>
    </div>
    <div className="button-row"><button className="primary" onClick={findLeagues} disabled={!!busy}>{busy==='leagues'?'Mencari...':'Cari kompetisi'}</button></div>
    {leagues.length>0&&<div className="form-grid">
      <label className="field"><span>PILIH KOMPETISI</span><select value={leagueId} onChange={e=>setLeagueId(e.target.value)}>{leagues.map(x=><option key={x.league.id} value={x.league.id}>{x.league.name} · {x.country?.name || 'International'} · ID {x.league.id}</option>)}</select></label>
      <div className="field"><span>INFO KOMPETISI</span><small>{selectedLeague?.country?.name || '—'} · {selectedLeague?.seasons?.find(s=>String(s.year)===season)?.coverage?.fixtures?.events?'Events tersedia':'Cakupan sesuai provider'}</small></div>
    </div>}
    {leagues.length>0&&<div className="button-row"><button className="secondary" onClick={loadTeams} disabled={!!busy}>{busy==='teams'?'Memuat tim...':'Muat tim ke Match Analysis'}</button></div>}
    <div className="divider-line"/>
    <div className="form-grid">
      <label className="field"><span>TANGGAL JADWAL</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
      <div className="field"><span>AKSI JADWAL</span><button className="secondary" onClick={loadFixtures} disabled={!!busy||!leagueId}>{busy==='fixtures'?'Memuat...':'Ambil jadwal kompetisi'}</button></div>
    </div>
    <div className="button-row"><button className="primary" onClick={loadLive} disabled={!!busy}>{busy==='live'?'Memuat skor...':'Refresh skor live'}</button></div>
    {error&&<div className="disclaimer">{error}</div>}
    {message&&<p className="muted tiny">{message}</p>}
    {fixtures.length>0&&<><h4 className="backtest-heading">Jadwal pertandingan</h4><div className="table-wrap"><table><thead><tr><th>WAKTU</th><th>PERTANDINGAN</th><th>SKOR</th><th>STATUS</th><th></th></tr></thead><tbody>{fixtures.map(x=><tr key={x.fixture.id}><td>{status(x)}</td><td>{x.teams?.home?.name} vs {x.teams?.away?.name}</td><td>{x.goals?.home??'—'} - {x.goals?.away??'—'}</td><td>{x.fixture?.status?.short}</td><td><button className="text-btn" onClick={()=>useFixture(x)}>Pakai tim</button></td></tr>)}</tbody></table></div></>}
    {live.length>0&&<><h4 className="backtest-heading">Pertandingan live</h4><div className="table-wrap"><table><thead><tr><th>MENIT</th><th>PERTANDINGAN</th><th>SKOR</th><th>STATUS</th><th></th></tr></thead><tbody>{live.map(x=><tr key={x.fixture.id}><td>{x.fixture?.status?.elapsed??'—'}</td><td>{x.teams?.home?.name} vs {x.teams?.away?.name}</td><td>{x.goals?.home??0} - {x.goals?.away??0}</td><td>{x.fixture?.status?.short}</td><td><button className="text-btn" onClick={()=>useFixture(x)}>Pakai tim</button></td></tr>)}</tbody></table></div></>}
    <div className="disclaimer">Paket gratis memiliki batas 100 request/hari. Refresh skor dilakukan manual agar kuota tidak cepat habis. Feed live dan odds hanya tersedia untuk liga/bookmaker yang dicakup provider. Odds otomatis dan sinkronisasi lambda belum diaktifkan pada tahap ini.</div>
  </section>;
}
