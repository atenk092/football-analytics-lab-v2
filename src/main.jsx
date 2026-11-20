import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const TEAM_GROUPS = {
  "Indonesia": ["Arema FC","Bali United","Bhayangkara Presisi","Borneo FC","Dewa United","Madura United","Malut United","Persib Bandung","Persija Jakarta","Persik Kediri","Persis Solo","Persebaya Surabaya","PSBS Biak","PSM Makassar","PSIS Semarang","PSS Sleman","Semen Padang"],
  "Premier League": ["Arsenal","Aston Villa","Bournemouth","Brentford","Brighton & Hove Albion","Burnley","Chelsea","Crystal Palace","Everton","Fulham","Leeds United","Liverpool","Manchester City","Manchester United","Newcastle United","Nottingham Forest","Sunderland","Tottenham Hotspur","West Ham United","Wolverhampton Wanderers"],
  "La Liga": ["Athletic Club","Atlético Madrid","Barcelona","Celta Vigo","Getafe","Girona","Real Madrid","Real Sociedad","Sevilla","Valencia","Villarreal"],
  "Serie A": ["AC Milan","Atalanta","Bologna","Cagliari","Como","Fiorentina","Inter Milan","Juventus","Lazio","Napoli","Roma","Torino"],
  "Bundesliga": ["Bayer Leverkusen","Bayern Munich","Borussia Dortmund","Eintracht Frankfurt","Freiburg","RB Leipzig","Stuttgart","Werder Bremen"],
  "Ligue 1": ["AS Monaco","Lille","Lyon","Marseille","Nice","Paris Saint-Germain","Rennes","Strasbourg"],
  "Other": ["Ajax","Al Nassr","Al Hilal","Benfica","Celtic","FC Porto","Fenerbahçe","Galatasaray","PSV Eindhoven","Rangers","Sporting CP"]
};
const TEAM_OPTIONS = Object.entries(TEAM_GROUPS).flatMap(([league, teams]) => teams.map(team => ({league, team})));
const fmt = (n, d=1) => Number.isFinite(n) ? n.toFixed(d) : '—';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function factorial(n){ let x=1; for(let i=2;i<=n;i++) x*=i; return x; }
function pois(k, lambda){ return Math.exp(-lambda) * Math.pow(lambda,k) / factorial(k); }
function calculate(lh, la, rho=0.06){
  const max=10; let home=0,draw=0,away=0,total=0,score=[];
  for(let h=0;h<=max;h++) for(let a=0;a<=max;a++){
    let tau=1;
    if(h===0&&a===0) tau=1-(lh*la*rho);
    else if(h===0&&a===1) tau=1+(lh*rho);
    else if(h===1&&a===0) tau=1+(la*rho);
    else if(h===1&&a===1) tau=1-rho;
    const p=Math.max(0,pois(h,lh)*pois(a,la)*tau);
    score.push({h,a,p}); total+=p;
  }
  score=score.map(x=>({...x,p:x.p/total}));
  const probability=fn=>score.reduce((sum,x)=>sum+(fn(x)?x.p:0),0);
  for(const x of score){if(x.h>x.a)home+=x.p;else if(x.h===x.a)draw+=x.p;else away+=x.p;}
  const totals=[0.5,1.5,2.5,3.5,4.5,5.5].map(line=>({line,over:probability(x=>x.h+x.a>line),under:probability(x=>x.h+x.a<line)}));
  const teamTotals=side=>[0.5,1.5,2.5].map(line=>({line,over:probability(x=>x[side]>line),under:probability(x=>x[side]<line)}));
  const handicaps=[-1.5,-1,-0.5,0,0.5,1,1.5].map(line=>({line,win:probability(x=>x.h+line>x.a),push:probability(x=>x.h+line===x.a),lose:probability(x=>x.h+line<x.a)}));
  const bttsYes=probability(x=>x.h>0&&x.a>0), odd=probability(x=>(x.h+x.a)%2===1);
  return {home,draw,away,doubleChance:{homeDraw:home+draw,homeAway:home+away,drawAway:draw+away},totals,teamTotals:{home:teamTotals('h'),away:teamTotals('a')},handicaps,btts:{yes:bttsYes,no:1-bttsYes},goals:{odd,even:1-odd},score:score.sort((x,y)=>y.p-x.p).slice(0,5)};
}

function parseCsvRows(text){
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];
    if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;}
    else if(ch==='"'){quoted=!quoted;}
    else if(ch===','&&!quoted){row.push(cell.trim());cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(cell!==''||row.length){row.push(cell.trim());if(row.some(x=>x!==''))rows.push(row);}
  return rows;
}
const initialHistory=()=>{try{return JSON.parse(localStorage.getItem('fal_history')||'[]')}catch{return []}};
function estimateLambdas(history,home,away){
  const homeLeague=TEAM_OPTIONS.find(x=>x.team===home)?.league;
  const awayLeague=TEAM_OPTIONS.find(x=>x.team===away)?.league;
  const sameLeague=homeLeague&&homeLeague===awayLeague&&homeLeague!=='Other';
  const today=new Date();
  const valid=history.filter(m=>{
    if(!Number.isFinite(Number(m.hg))||!Number.isFinite(Number(m.ag))||Number(m.hg)<0||Number(m.ag)<0)return false;
    if(sameLeague&&m.league&&m.league!==homeLeague)return false;
    if(m.date){const d=new Date(m.date);if(!Number.isNaN(d.getTime())&&d>today)return false;}
    return true;
  }).map(m=>{
    const d=m.date?new Date(m.date):null;
    const age=d&&!Number.isNaN(d.getTime())?Math.max(0,(today-d)/86400000):365;
    return {...m,w:Math.exp(-Math.LN2*age/730)};
  });
  if(valid.length<5)return null;
  const sumW=valid.reduce((s,m)=>s+m.w,0);
  const avgH=valid.reduce((s,m)=>s+m.hg*m.w,0)/sumW;
  const avgA=valid.reduce((s,m)=>s+m.ag*m.w,0)/sumW;
  const teamStats=team=>{
    const games=valid.filter(m=>m.home===team||m.away===team);
    const weight=games.reduce((s,m)=>s+m.w,0);
    if(weight<2.5)return null;
    let scored=0,conceded=0,expectedFor=0,expectedAgainst=0;
    for(const m of games){
      const atHome=m.home===team;
      scored+=(atHome?m.hg:m.ag)*m.w;
      conceded+=(atHome?m.ag:m.hg)*m.w;
      expectedFor+=(atHome?avgH:avgA)*m.w;
      expectedAgainst+=(atHome?avgA:avgH)*m.w;
    }
    const shrink=weight/(weight+5);
    return {
      attack:1+((scored/Math.max(expectedFor,.2))-1)*shrink,
      defense:1+((conceded/Math.max(expectedAgainst,.2))-1)*shrink,
      sample:games.length
    };
  };
  const h=teamStats(home),a=teamStats(away);
  if(!h||!a)return null;
  return {
    home:clamp(avgH*h.attack*a.defense,.15,4.5),
    away:clamp(avgA*a.attack*h.defense,.15,4.5),
    sample:valid.length,
    homeSample:h.sample,
    awaySample:a.sample,
    weightedSample:sumW,
    league:sameLeague?homeLeague:'gabungan data'
  };
}
const initialMatches = () => { try{return JSON.parse(localStorage.getItem('fal_matches')||'[]')}catch{return []} };
function App(){
  const [tab,setTab]=useState('overview');
  const [home,setHome]=useState(''),[away,setAway]=useState('');
  const [lh,setLh]=useState(1.55),[la,setLa]=useState(1.10),[rho,setRho]=useState(0.06);
  const [odds,setOdds]=useState(2.10),[stake,setStake]=useState(100000);
  const [matches,setMatches]=useState(initialMatches);
  const [history,setHistory]=useState(initialHistory);
  const [notice,setNotice]=useState('');
  const result=useMemo(()=>calculate(Number(lh),Number(la),Number(rho)),[lh,la,rho]);
  const lambdaEstimate=useMemo(()=>home&&away&&home!==away?estimateLambdas(history,home,away):null,[history,home,away]);
  useEffect(()=>{if(lambdaEstimate){setLh(Number(lambdaEstimate.home.toFixed(2)));setLa(Number(lambdaEstimate.away.toFixed(2)));}},[lambdaEstimate]);
  const lambdaStatus=!home||!away?'Pilih kedua tim untuk menghitung lambda otomatis.':home===away?'Pilih dua tim yang berbeda.':lambdaEstimate?'Otomatis · '+lambdaEstimate.homeSample+' laga kandang/tandang untuk tim kandang, '+lambdaEstimate.awaySample+' untuk tim tandang · bobot 2 tahun.':'Data historis belum cukup: perlu minimal 5 hasil valid dan 3 laga per tim. Impor CSV terlebih dahulu.';

  const p=Number(result.over25);
  const ev=p*Number(odds)-1;
  const b=Number(odds)-1, kelly=b>0?clamp((b*p-(1-p))/b,0,1):0;
  function saveMatch(){
    if(!home||!away){setNotice('Pilih tim kandang dan tim tandang terlebih dahulu.');return;}
    if(home===away){setNotice('Tim kandang dan tandang tidak boleh sama.');return;}
    const item={id:Date.now(),date:new Date().toISOString().slice(0,10),home,away,lambda_home:Number(lh),lambda_away:Number(la),rho:Number(rho),p_home:result.home,p_draw:result.draw,p_away:result.away};
    const next=[item,...matches]; setMatches(next); localStorage.setItem('fal_matches',JSON.stringify(next)); setNotice('Analisis tersimpan di perangkat.'); setTimeout(()=>setNotice(''),2500);
  }

  function importHistoryCsv(e){
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();reader.onload=()=>{
      try{
        const rows=parseCsvRows(String(reader.result||''));const headers=(rows.shift()||[]).map(x=>x.replace(/^\uFEFF/,'').toLowerCase().trim());
        const pick=(r,names)=>{const i=headers.findIndex(h=>names.includes(h));return i<0?'':r[i]||'';};
        const added=[];
        for(const row of rows){
          const home=pick(row,['home_team','hometeam','home']);const away=pick(row,['away_team','awayteam','away']);
          const hgRaw=pick(row,['home_goals','fthg','hg']);const agRaw=pick(row,['away_goals','ftag','ag']);
          if(!home||!away||hgRaw===''||agRaw==='')continue;
          const hg=Number(hgRaw),ag=Number(agRaw);
          if(!Number.isInteger(hg)||!Number.isInteger(ag)||hg<0||ag<0)continue;
          added.push({id:'hist-'+Date.now()+'-'+added.length,date:pick(row,['date']),league:pick(row,['league']),home,away,hg,ag});
        }
        const key=m=>[m.date,m.league,m.home,m.away,m.hg,m.ag].join('|').toLowerCase();
        const seen=new Set(history.map(key));const unique=added.filter(m=>{const k=key(m);if(seen.has(k))return false;seen.add(k);return true;});
        const next=[...history,...unique].sort((a,b)=>(a.date||'').localeCompare(b.date||''));setHistory(next);localStorage.setItem('fal_history',JSON.stringify(next));
        setNotice(unique.length+' hasil baru diimpor; '+(added.length-unique.length)+' duplikat dilewati.');setTimeout(()=>setNotice(''),3500);
      }catch{setNotice('CSV historis tidak terbaca.');}
    };reader.readAsText(file);e.target.value='';
  }

  function exportHistoryCsv(){
    const rows=[['date','league','home_team','away_team','home_goals','away_goals'],...history.map(m=>[m.date,m.league,m.home,m.away,m.hg,m.ag])];
    const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='fal_historical_results.csv';a.click();URL.revokeObjectURL(url);
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
    {tab==='analysis'&&<><section className="panel"><div className="panel-head"><div><div className="eyebrow">PRE-MATCH MODEL</div><h3>Input pertandingan</h3></div><span className="tag">DIXON-COLES · v1</span></div><div className="form-grid"><Field label="HOME TEAM"><select value={home} onChange={e=>setHome(e.target.value)}><option value="">Pilih tim kandang</option>{Object.entries(TEAM_GROUPS).map(([league,teams])=><optgroup key={league} label={league}>{teams.map(team=><option key={team} value={team}>{team}</option>)}</optgroup>)}</select></Field><Field label="AWAY TEAM"><select value={away} onChange={e=>setAway(e.target.value)}><option value="">Pilih tim tandang</option>{Object.entries(TEAM_GROUPS).map(([league,teams])=><optgroup key={league} label={league}>{teams.map(team=><option key={team} value={team}>{team}</option>)}</optgroup>)}</select></Field><Field label="LAMBDA HOME" hint="Terisi otomatis dari data historis"><input type="number" value={lh} readOnly/></Field><Field label="LAMBDA AWAY" hint="Terisi otomatis dari data historis"><input type="number" value={la} readOnly/></Field><Field label="DIXON-COLES RHO" hint="Koreksi skor rendah · default 0.06"><input type="number" min="-0.2" max="0.2" step=".01" value={rho} onChange={e=>setRho(e.target.value)}/></Field></div><p className="muted tiny lambda-status">{lambdaStatus}</p><div className="button-row analysis-actions"><button className="primary save-btn" onClick={saveMatch}>Simpan analisis</button></div></section>
      <section className="results-grid"><div className="panel"><div className="eyebrow">1X2 PROBABILITY</div><h3>Match outcome</h3><div className="prob-row"><Prob label="HOME" value={result.home}/><Prob label="DRAW" value={result.draw}/><Prob label="AWAY" value={result.away}/></div><div className="bar"><i style={{width:(result.home*100)+'%'}}/><i style={{width:(result.draw*100)+'%'}}/><i style={{width:(result.away*100)+'%'}}/></div><div className="ou-row"><div><span>OVER 2.5</span><b>{fmt(result.totals[2].over*100,2)}%</b></div><div><span>UNDER 2.5</span><b>{fmt(result.totals[2].under*100,2)}%</b></div></div></div>
      <div className="panel"><div className="eyebrow">MOST LIKELY SCORES</div><h3>Correct score</h3>{result.score.map((s,i)=><div className="score-line" key={i}><span className="rank">0{i+1}</span><b>{s.h} - {s.a}</b><div className="mini-track"><i style={{width:(s.p/result.score[0].p*100)+'%'}}/></div><strong>{fmt(s.p*100,2)}%</strong></div>)}</div></section>
      <section className="panel market-panel"><div className="panel-head"><div><div className="eyebrow">EXPANDED MARKET PROBABILITIES</div><h3>Pasar probabilitas</h3></div><span className="tag">MODEL DISTRIBUTION</span></div>
        <div className="market-grid">
          <div className="market-card"><h4>Double chance</h4>{[['1X',result.doubleChance.homeDraw],['12',result.doubleChance.homeAway],['X2',result.doubleChance.drawAway]].map(([label,value])=><div className="market-line" key={label}><span>{label}</span><b>{fmt(value*100,2)}%</b></div>)}</div>
          <div className="market-card"><h4>Both teams to score</h4>{[['BTTS Yes',result.btts.yes],['BTTS No',result.btts.no]].map(([label,value])=><div className="market-line" key={label}><span>{label}</span><b>{fmt(value*100,2)}%</b></div>)}</div>
          <div className="market-card"><h4>Total goals · Over / Under</h4>{result.totals.map(x=><div className="market-line" key={x.line}><span>{x.line.toFixed(1)} · O {fmt(x.over*100,1)}% / U {fmt(x.under*100,1)}%</span><b>{fmt(x.over*100,1)}%</b></div>)}</div>
          <div className="market-card"><h4>Home team goals</h4>{result.teamTotals.home.map(x=><div className="market-line" key={x.line}><span>O/U {x.line.toFixed(1)}</span><b>{fmt(x.over*100,2)}% / {fmt(x.under*100,2)}%</b></div>)}</div>
          <div className="market-card"><h4>Away team goals</h4>{result.teamTotals.away.map(x=><div className="market-line" key={x.line}><span>O/U {x.line.toFixed(1)}</span><b>{fmt(x.over*100,2)}% / {fmt(x.under*100,2)}%</b></div>)}</div>
          <div className="market-card"><h4>Odd / Even goals</h4>{[['Odd',result.goals.odd],['Even',result.goals.even]].map(([label,value])=><div className="market-line" key={label}><span>{label}</span><b>{fmt(value*100,2)}%</b></div>)}</div>
        </div>
        <div className="market-card handicap-card"><h4>Asian handicap · perspektif tim kandang</h4><div className="handicap-list">{result.handicaps.map(x=><div className="handicap-line" key={x.line}><b>{x.line>0?'+':''}{x.line.toFixed(1)}</b><span>Menang {fmt(x.win*100,1)}%</span><span>Push {fmt(x.push*100,1)}%</span><span>Kalah {fmt(x.lose*100,1)}%</span></div>)}</div></div>
      </section>
      <section className="disclaimer">Semua pasar dihitung dari distribusi skor Poisson dengan koreksi Dixon-Coles. Asian handicap menampilkan peluang menang/push/kalah untuk garis handicap tim kandang. Garis total dan team total yang ditampilkan adalah garis setengah gol, sehingga tidak memiliki hasil push. Distribusi skor dibatasi 0–10 gol per tim dan dinormalisasi kembali; hasil bukan jaminan.</section></>}
    {tab==='database'&&<section className="panel"><div className="panel-head"><div><div className="eyebrow">LOCAL DATASET</div><h3>Match database <span className="count">{matches.length}</span></h3></div><div className="button-row"><label className="secondary file-btn">Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv}/></label><button className="secondary" onClick={exportCsv}>Export CSV ↓</button></div></div><div className="panel-subhead"><h3>Historical results <span className="count">{history.length}</span></h3><div className="button-row"><label className="secondary file-btn">Import historical CSV<input type="file" accept=".csv,text/csv" onChange={importHistoryCsv}/></label><button className="secondary" onClick={exportHistoryCsv} disabled={!history.length}>Export history ↓</button></div></div><p className="muted tiny">Format: date, league (opsional), home_team, away_team, home_goals, away_goals. Mendukung juga FTHG dan FTAG.</p>{history.length?<div className="history-list">{history.slice(-8).reverse().map(m=><div className="history-row" key={m.id}><span>{m.date||"—"}</span><b>{m.home}</b><strong>{m.hg} - {m.ag}</strong><b>{m.away}</b></div>)}</div>:<Empty text="Belum ada hasil historis. Impor CSV untuk membangun basis data performa tim."/>}<div className="divider-line"/>{matches.length?<MatchTable rows={matches}/>:<Empty text="Database masih kosong. Simpan analisis atau impor CSV untuk mulai mengisi."/>}<p className="muted tiny">Data tersimpan di browser/perangkat ini. Ekspor CSV secara berkala untuk backup.</p></section>}
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