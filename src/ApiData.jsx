import React, { useMemo, useState } from 'react';

const DEFAULT_API_BASE = 'https://flourishing-sundae-4d9deb.netlify.app/.netlify/functions/football';

export default function ApiData({ onTeamsLoaded, onSelectTeams }) {
  const base = (import.meta.env.VITE_FAL_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '');
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

  async function call(action, params = {}) {
    const url = new URL(base);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) url.searchParams.set(key, String(value));
    });
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok || data.errors && Object.keys(data.errors).length) {
      const detail = data.error || Object.values(data.errors || {}).filter(Boolean).join(', ') || ('HTTP ' + response.status);
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
    <div className="panel-head"><div><div className="eyebrow">LIVE DATA PROVIDER</div><h3>API-Football connection</h3></div><span className="tag">SERVER-SIDE KEY</span></div>
    <p className="muted">Hubungkan kompetisi, daftar tim, jadwal, dan skor live. API key tidak dimasukkan ke aplikasi; permintaan melewati Netlify Function.</p>
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
