import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const fmt = (n, d=1) => Number.isFinite(n) ? n.toFixed(d) : '—';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function factorial(n){ let x=1; for(let i=2;i<=n;i++) x*=i; return x; }
function pois(k, lambda){ return Math.exp(-lambda) * Math.pow(lambda,k) / factorial(k); }
function calculate(lh, la){
  const max=10; let home=0,draw=0,away=0,over25=0,under25=0,score=[];
  for(let h=0;h<=max;h++) for(let a=0;a<=max;a++){
    const p=pois(h,lh)*pois(a,la); score.push({h,a,p});
    if(h>a) home+=p; else if(h===a) draw+=p; else away+=p;
    if(h+a>=3) over25+=p; else under25+=p;
  }
  return {home,draw,away,over25,under25,score:score.sort((x,y)=>y.p-x.p).slice(0,5)};
}
const initialMatches = () => { try{return JSON.parse(localStorage.getItem('fal_matches')||'[]')}catch{return []} };
function App(){
  const [tab,setTab]=useState('overview');
  const [home,setHome]=useState('Home Team'),[away,setAway]=useState('Away Team');
  const [lh,setLh]=useState(1.55),[la,setLa]=useState(1.10);
  const [odds,setOdds]=useState(2.10),[stake,setStake]=useState(100000);
  const [matches,setMatches]=useState(initialMatches);
  const [notice,setNotice]=useState('');
  const result=useMemo(()=>calculate(Number(lh),Number(la)),[lh,la]);
  const p=Number(result.over25);
  const ev=p*Number(odds)-1;
  const b=Number(odds)-1, kelly=b>0?clamp((b*p-(1-p))/b,0,1):0;
  function saveMatch(){
    const item={id:Date.now(),date:new Date().toISOString().slice(0,10),home,away,lambda_home:Number(lh),lambda_away:Number(la),p_home:result.home,p_draw:result.draw,p_away:result.away};
    const next=[item,...matches]; setMatches(next); localStorage.setItem('fal_matches',JSON.stringify(next)); setNotice('Analisis tersimpan di perangkat.'); setTimeout(()=>setNotice(''),2500);
  }
  function exportCsv(){
    const rows=[['date','home_team','away_team','lambda_home','lambda_away','p_home','p_draw','p_away'],...matches.map(m=>[m.date,m.home,m.away,m.lambda_home,m.lambda_away,m.p_home,m.p_draw,m.p_away])];
    const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); const a=document.createElement('a'); a.href=url; a.download='fal_matches.csv'; a.click(); URL.revokeObjectURL(url);
  }
  function importCsv(e){
    const file=e.target.files?.[0]; if(!file)return;
    const reader=new FileReader(); reader.onload=()=>{try{
      const lines=String(reader.result).trim().split(/\r?\n/); const head=lines.shift().split(',').map(x=>x.replaceAll('"','').trim());
      const idx=k=>head.indexOf(k); const added=[];
      for(const line of lines){const c=line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map(x=>x.replace(/,$/,'').replace(/^"|"$/g,'').replaceAll('""','"'))||[]; const get=k=>c[idx(k)]||'';
        if(!get('home_team')||!get('away_team'))continue;
        added.push({id:Date.now()+added.length,date:get('date')||'',home:get('home_team'),away:get('away_team'),lambda_home:Number(get('lambda_home'))||null,lambda_away:Number(get('lambda_away'))||null,p_home:null,p_draw:null,p_away:null});
      }
      const next=[...added,...matches];setMatches(next);localStorage.setItem('fal_matches',JSON.stringify(next));setNotice(added.length+' baris diimpor.');setTimeout(()=>setNotice(''),3000);
    }catch{setNotice('CSV tidak terbaca. Periksa header.');}}; reader.readAsText(file); e.target.value='';
  }
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">F</div><div><b>FOOTBALL</b><span>ANALYTICS LAB</span></div></div>
      <div className="nav-label">WORKSPACE</div>
      {[['overview','▦','Dashboard'],['analysis','◎','Match Analysis'],['database','▤','Match Database'],['tools','⌁','EV & Kelly']].map(([id,ic,label])=><button key={id} className={'nav-item '+(tab===id?'active':'')} onClick={()=>setTab(id)}><span>{ic}</span>{label}</button>)}
      <div className="sidebar-bottom"><span className="pulse"></span> LOCAL MODE <small>v1.0.0 MVP</small></div>
    </aside>
    <main className="main"><header className="topbar"><div><span className="eyebrow">FOOTBALL INTELLIGENCE / WORKSPACE</span><h1>{({overview:'Dashboard',analysis:'Match Analysis',database:'Match Database',tools:'EV & Kelly'})[tab]}</h1></div><div className="top-actions"><span className="local-pill">● Offline-ready</span><div className="avatar">FA</div></div></header>
    {notice&&<div className="notice">{notice}</div>}
    {tab==='overview'&&<><section className="welcome"><div><div className="eyebrow mint">PERFORMANCE OVERVIEW</div><h2>Data first. <em>Decisions smarter.</em></h2><p>Ruang kerja analisis pertandingan berbasis probabilitas dan statistik.</p></div><div className="welcome-ball">◉</div></section>
      <section className="stat-grid"><Stat label="SAVED ANALYSES" value={matches.length} hint="Tersimpan di perangkat"/><Stat label="MODEL ENGINE" value="Poisson" hint="Independent goal model"/><Stat label="DATA MODE" value="Manual" hint="API belum terhubung"/></section>
      <section className="panel"><div className="panel-head"><div><div className="eyebrow">QUICK ACCESS</div><h3>Mulai analisis</h3></div><button className="primary" onClick={()=>setTab('analysis')}>Buka Match Analysis ↗</button></div><p className="muted">Masukkan estimasi gol (lambda) kandang dan tandang untuk menghitung probabilitas skor, 1X2, dan Over/Under 2.5.</p></section>
      <section className="panel"><div className="panel-head"><h3>Analisis terbaru</h3><button className="text-btn" onClick={()=>setTab('database')}>Lihat database →</button></div>{matches.length?<MatchTable rows={matches.slice(0,5)}/>:<Empty text="Belum ada analisis tersimpan. Mulai dari Match Analysis."/>}</section></>}
    {tab==='analysis'&&<><section className="panel"><div className="panel-head"><div><div className="eyebrow">PRE-MATCH MODEL</div><h3>Input pertandingan</h3></div><span className="tag">POISSON · v1</span></div><div className="form-grid"><Field label="HOME TEAM"><input value={home} onChange={e=>setHome(e.target.value)}/></Field><Field label="AWAY TEAM"><input value={away} onChange={e=>setAway(e.target.value)}/></Field><Field label="LAMBDA HOME" hint="Expected home goals"><input type="number" min="0" max="6" step=".01" value={lh} onChange={e=>setLh(e.target.value)}/></Field><Field label="LAMBDA AWAY" hint="Expected away goals"><input type="number" min="0" max="6" step=".01" value={la} onChange={e=>setLa(e.target.value)}/></Field></div><button className="primary save-btn" onClick={saveMatch}>Simpan analisis</button></section>
      <section className="results-grid"><div className="panel"><div className="eyebrow">1X2 PROBABILITY</div><h3>Match outcome</h3><div className="prob-row"><Prob label="HOME" value={result.home}/><Prob label="DRAW" value={result.draw}/><Prob label="AWAY" value={result.away}/></div><div className="bar"><i style={{width:(result.home*100)+'%'}}/><i style={{width:(result.draw*100)+'%'}}/><i style={{width:(result.away*100)+'%'}}/></div><div className="ou-row"><div><span>OVER 2.5</span><b>{fmt(result.over25*100,2)}%</b></div><div><span>UNDER 2.5</span><b>{fmt(result.under25*100,2)}%</b></div></div></div>
      <div className="panel"><div className="eyebrow">MOST LIKELY SCORES</div><h3>Correct score</h3>{result.score.map((s,i)=><div className="score-line" key={i}><span className="rank">0{i+1}</span><b>{s.h} - {s.a}</b><div className="mini-track"><i style={{width:(s.p/result.score[0].p*100)+'%'}}/></div><strong>{fmt(s.p*100,2)}%</strong></div>)}</div></section>
      <section className="disclaimer">Model ini memakai Poisson independen dan lambda manual. Probabilitas skor dibatasi 0–10 gol per tim, sehingga ada pembulatan ekor distribusi. Belum ada koreksi Dixon-Coles atau kalibrasi historis.</section></>}
    {tab==='database'&&<section className="panel"><div className="panel-head"><div><div className="eyebrow">LOCAL DATASET</div><h3>Match database <span className="count">{matches.length}</span></h3></div><div className="button-row"><label className="secondary file-btn">Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv}/></label><button className="secondary" onClick={exportCsv}>Export CSV ↓</button></div></div>{matches.length?<MatchTable rows={matches}/>:<Empty text="Database masih kosong. Simpan analisis atau impor CSV untuk mulai mengisi."/>}<p className="muted tiny">Data tersimpan di browser/perangkat ini. Ekspor CSV secara berkala untuk backup.</p></section>}
    {tab==='tools'&&<section className="panel"><div className="eyebrow">VALUE & STAKING</div><h3>Expected Value & Kelly</h3><p className="muted">Contoh kalkulator untuk pilihan Over 2.5 berdasarkan probabilitas model.</p><div className="form-grid"><Field label="ODDS DECIMAL"><input type="number" min="1.01" step=".01" value={odds} onChange={e=>setOdds(e.target.value)}/></Field><Field label="STAKE / BANKROLL (IDR)"><input type="number" min="0" step="1000" value={stake} onChange={e=>setStake(e.target.value)}/></Field></div><div className="tool-results"><div><span>MODEL PROBABILITY · OVER 2.5</span><b>{fmt(p*100,2)}%</b></div><div><span>EXPECTED VALUE</span><b className={ev>=0?'positive':'negative'}>{ev>=0?'+':''}{fmt(ev*100,2)}%</b></div><div><span>FULL KELLY</span><b>{fmt(kelly*100,2)}%</b></div><div><span>FULL KELLY STAKE</span><b>Rp {Math.round(kelly*Number(stake)).toLocaleString('id-ID')}</b></div></div><div className="disclaimer">EV positif bukan jaminan hasil. Estimasi ini sangat bergantung pada kualitas lambda dan probabilitas model. Pertimbangkan fractional Kelly dan batas risiko; jangan mempertaruhkan dana yang tidak siap hilang.</div></section>}
    <footer>FOOTBALL ANALYTICS LAB <span>Built for disciplined analysis · {new Date().getFullYear()}</span></footer></main>
  </div>
}
function Stat({label,value,hint}){return <div className="stat-card"><span>{label}</span><b>{value}</b><small>{hint}</small></div>}
function Field({label,hint,children}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
function Prob({label,value}){return <div className="prob"><span>{label}</span><b>{fmt(value*100,1)}%</b></div>}
function MatchTable({rows}){return <div className="table-wrap"><table><thead><tr><th>DATE</th><th>HOME</th><th></th><th>AWAY</th><th>λ HOME</th><th>λ AWAY</th></tr></thead><tbody>{rows.map(m=><tr key={m.id}><td>{m.date||'—'}</td><td>{m.home}</td><td className="vs">vs</td><td>{m.away}</td><td>{m.lambda_home??'—'}</td><td>{m.lambda_away??'—'}</td></tr>)}</tbody></table></div>}
function Empty({text}){return <div className="empty"><span>▤</span><p>{text}</p></div>}
createRoot(document.getElementById('root')).render(<App/>);