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


function calculateLive(lh,la,minute,scoreHome,scoreAway,redHome,redAway,rho=0.06){
  const remaining=clamp((90-minute)/90,0,1);
  const stateHome=scoreHome<scoreAway?1.16:scoreHome>scoreAway?0.92:1;
  const stateAway=scoreAway<scoreHome?1.16:scoreAway>scoreHome?0.92:1;
  const liveHome=lh*remaining*stateHome*(redHome?0.66:1)*(redAway?1.16:1);
  const liveAway=la*remaining*stateAway*(redAway?0.66:1)*(redHome?1.16:1);
  const dist=[];let total=0;
  for(let h=0;h<=10;h++)for(let a=0;a<=10;a++){
    let tau=1;
    if(h===0&&a===0)tau=1-liveHome*liveAway*rho;
    else if(h===0&&a===1)tau=1+liveHome*rho;
    else if(h===1&&a===0)tau=1+liveAway*rho;
    else if(h===1&&a===1)tau=1-rho;
    const p=Math.max(0,pois(h,liveHome)*pois(a,liveAway)*tau);
    dist.push({h:scoreHome+h,a:scoreAway+a,p});total+=p;
  }
  const prob=fn=>dist.reduce((sum,x)=>sum+(fn(x)?x.p/total:0),0);
  const home=prob(x=>x.h>x.a),draw=prob(x=>x.h===x.a),away=prob(x=>x.h<x.a);
  return {liveHome,liveAway,home,draw,away,over25:prob(x=>x.h+x.a>=3),under25:prob(x=>x.h+x.a<=2),btts:prob(x=>x.h>0&&x.a>0),score:dist.map(x=>({...x,p:x.p/total})).sort((x,y)=>y.p-x.p).slice(0,5)};
}
function runWalkForwardBacktest(history, limit=500){
  const dated=history.filter(m=>/^\d{4}-\d{2}-\d{2}$/.test(String(m.date||''))&&Number.isInteger(Number(m.hg))&&Number.isInteger(Number(m.ag))&&Number(m.hg)>=0&&Number(m.ag)>=0)
    .slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(dated.length<10)return {error:'Butuh minimal 10 hasil historis bertanggal untuk memulai backtest.'};
  const start=Math.max(0,dated.length-limit);
  let trainEnd=0,used=0,correct=0,ouCorrect=0,logLoss=0,brier=0,ouBrier=0;
  let bets=0,wins=0,profitUnits=0,evSum=0,oddsSum=0;
  const examples=[];
  for(let i=start;i<dated.length;i++){
    const target=dated[i];
    while(trainEnd<dated.length&&dated[trainEnd].date<target.date)trainEnd++;
    if(trainEnd<5)continue;
    const estimate=estimateLambdas(dated.slice(0,trainEnd),target.home,target.away,target.date);
    if(!estimate)continue;
    const prediction=calculate(estimate.home,estimate.away,0.06);
    const actual=Number(target.hg)>Number(target.ag)?0:Number(target.hg)===Number(target.ag)?1:2;
    const probs=[prediction.home,prediction.draw,prediction.away];
    const actualProb=clamp(probs[actual],1e-12,1);
    logLoss-=Math.log(actualProb);
    brier+=probs.reduce((sum,p,j)=>sum+Math.pow(p-(j===actual?1:0),2),0);
    const predicted=probs.indexOf(Math.max(...probs));
    if(predicted===actual)correct++;
    const actualOver=Number(target.hg)+Number(target.ag)>=3?1:0;
    const pOver=prediction.totals[2].over;
    ouBrier+=Math.pow(pOver-actualOver,2);
    if((pOver>=0.5?1:0)===actualOver)ouCorrect++;
    const candidates=[];
    const addBet=(market,selection,prob,odd,won)=>{
      const price=Number(odd);
      if(Number.isFinite(price)&&price>1&&Number.isFinite(prob)){
        const expected=prob*price-1;
        if(expected>0.03)candidates.push({market,selection,prob,odds:price,ev:expected,won});
      }
    };
    addBet('1X2','Home',prediction.home,target.oddsHome,Number(target.hg)>Number(target.ag));
    addBet('1X2','Draw',prediction.draw,target.oddsDraw,Number(target.hg)===Number(target.ag));
    addBet('1X2','Away',prediction.away,target.oddsAway,Number(target.hg)<Number(target.ag));
    addBet('O/U 2.5','Over',pOver,target.oddsOver25,actualOver===1);
    addBet('O/U 2.5','Under',prediction.totals[2].under,target.oddsUnder25,actualOver===0);
    const selected=candidates.sort((a,b)=>b.ev-a.ev)[0];
    if(selected){
      bets++;evSum+=selected.ev;oddsSum+=selected.odds;
      if(selected.won){wins++;profitUnits+=selected.odds-1;}else profitUnits-=1;
    }
    used++;
    if(examples.length<5)examples.push({date:target.date,home:target.home,away:target.away,score:Number(target.hg)+'-'+Number(target.ag),predicted:['Home','Draw','Away'][predicted],confidence:probs[predicted]});
  }
  if(!used)return {error:'Belum ada pertandingan yang dapat diuji. Pastikan CSV berisi tanggal valid, nama tim konsisten, dan data sebelum tanggal pertandingan mencukupi.'};
  return {total:dated.length,tested:used,accuracy:correct/used,logLoss:logLoss/used,brier:brier/used,ouAccuracy:ouCorrect/used,ouBrier:ouBrier/used,bets,wins,winRate:bets?wins/bets:0,profitUnits,roi:bets?profitUnits/bets:0,avgEv:bets?evSum/bets:0,avgOdds:bets?oddsSum/bets:0,examples};
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
function estimateLambdas(history,home,away,asOf=null){
  const homeLeague=TEAM_OPTIONS.find(x=>x.team===home)?.league;
  const awayLeague=TEAM_OPTIONS.find(x=>x.team===away)?.league;
  const sameLeague=homeLeague&&homeLeague===awayLeague&&homeLeague!=='Other';
  const today=asOf?new Date(asOf+'T23:59:59'):new Date();
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
  const [odds,setOdds]=useState(2.10),[stake,setStake]=useState(100000),[kellyFraction,setKellyFraction]=useState(0.25),[riskCap,setRiskCap]=useState(0.02);
  const [matches,setMatches]=useState(initialMatches);
  const [history,setHistory]=useState(initialHistory);
  const [notice,setNotice]=useState('');
  const [backtest,setBacktest]=useState(null);
  const [betLog,setBetLog]=useState(()=>{try{return JSON.parse(localStorage.getItem('fal_bet_log')||'[]')}catch{return []}});
  const [betSelection,setBetSelection]=useState('Over 2.5');
  const [betOdds,setBetOdds]=useState('2.00');
  const [betStake,setBetStake]=useState('25000');
  const [betFixture,setBetFixture]=useState('');
  const [liveMinute,setLiveMinute]=useState(60),[liveHomeScore,setLiveHomeScore]=useState(0),[liveAwayScore,setLiveAwayScore]=useState(0),[liveHomeRed,setLiveHomeRed]=useState(0),[liveAwayRed,setLiveAwayRed]=useState(0);
  const result=useMemo(()=>calculate(Number(lh),Number(la),Number(rho)),[lh,la,rho]);
  const lambdaEstimate=useMemo(()=>home&&away&&home!==away?estimateLambdas(history,home,away):null,[history,home,away]);
  useEffect(()=>{if(lambdaEstimate){setLh(Number(lambdaEstimate.home.toFixed(2)));setLa(Number(lambdaEstimate.away.toFixed(2)));}},[lambdaEstimate]);
  const lambdaStatus=!home||!away?'Pilih kedua tim untuk menghitung lambda otomatis.':home===away?'Pilih dua tim yang berbeda.':lambdaEstimate?'Otomatis · '+lambdaEstimate.homeSample+' laga kandang/tandang untuk tim kandang, '+lambdaEstimate.awaySample+' untuk tim tandang · bobot 2 tahun.':'Data historis belum cukup: perlu minimal 5 hasil valid dan 3 laga per tim. Impor CSV terlebih dahulu.';

  const liveResult=useMemo(()=>home&&away&&home!==away?calculateLive(Number(lh),Number(la),Number(liveMinute),Number(liveHomeScore),Number(liveAwayScore),Number(liveHomeRed),Number(liveAwayRed),Number(rho)):null,[home,away,lh,la,liveMinute,liveHomeScore,liveAwayScore,liveHomeRed,liveAwayRed,rho]);
  const p=Number(result.totals[2].over);
  const ev=p*Number(odds)-1;
  const b=Number(odds)-1, kelly=b>0?clamp((b*p-(1-p))/b,0,1):0;
  const bankroll=Math.max(0,Number(stake)||0),rawStake=kelly*Number(kellyFraction)*bankroll,capStake=bankroll*Number(riskCap),recommendedStake=Math.min(rawStake,capStake),effectiveFraction=bankroll>0?recommendedStake/bankroll:0;
  function addBet(){
    const price=Number(betOdds),amount=Number(betStake);
    if(!Number.isFinite(price)||price<=1||!Number.isFinite(amount)||amount<=0){setNotice('Masukkan odds di atas 1.00 dan stake lebih dari 0.');return;}
    const fixture=betFixture.trim()||(home&&away?home+' vs '+away:'Pertandingan belum diisi');
    const next=[{id:Date.now(),date:new Date().toISOString().slice(0,10),fixture,selection:betSelection,odds:price,stake:amount,status:'open'},...betLog];
    setBetLog(next);localStorage.setItem('fal_bet_log',JSON.stringify(next));setNotice('Taruhan ditambahkan ke Bet Tracker.');setTimeout(()=>setNotice(''),2500);
  }
  function settleBet(id,status){const next=betLog.map(b=>b.id===id?{...b,status}:b);setBetLog(next);localStorage.setItem('fal_bet_log',JSON.stringify(next));}
  function exportBetLog(){const rows=[['date','fixture','selection','odds','stake','status','profit_loss'],...betLog.map(b=>[b.date,b.fixture,b.selection,b.odds,b.stake,b.status,b.status==='win'?b.stake*(b.odds-1):b.status==='loss'?-b.stake:0])];const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='fal_bet_tracker.csv';a.click();URL.revokeObjectURL(url);}
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
          const readOdd=names=>{const raw=pick(row,names);const value=Number(raw);return raw!==''&&Number.isFinite(value)&&value>1?value:null;};
          added.push({id:'hist-'+Date.now()+'-'+added.length,date:pick(row,['date']),league:pick(row,['league']),home,away,hg,ag,
            oddsHome:readOdd(['odds_home','home_odds','odds1','odd_home']),
            oddsDraw:readOdd(['odds_draw','draw_odds','oddsx','odd_draw']),
            oddsAway:readOdd(['odds_away','away_odds','odds2','odd_away']),
            oddsOver25:readOdd(['odds_over25','over25_odds','odds_o25','over_2_5']),
            oddsUnder25:readOdd(['odds_under25','under25_odds','odds_u25','under_2_5'])});
        }
        const key=m=>[m.date,m.league,m.home,m.away,m.hg,m.ag].join('|').toLowerCase();
        const next=[...history];const indexByKey=new Map(next.map((m,i)=>[key(m),i]));let newCount=0,enriched=0;
        for(const m of added){const k=key(m);if(indexByKey.has(k)){const i=indexByKey.get(k);const old=next[i];const merged={...old};
          ['oddsHome','oddsDraw','oddsAway','oddsOver25','oddsUnder25'].forEach(field=>{if(m[field]!=null&&old[field]==null){merged[field]=m[field];enriched++;}});
          next[i]=merged;
        }else{indexByKey.set(k,next.length);next.push(m);newCount++;}}
        next.sort((a,b)=>(a.date||'').localeCompare(b.date||''));setHistory(next);localStorage.setItem('fal_history',JSON.stringify(next));
        setNotice(newCount+' hasil baru; '+enriched+' data odds ditambahkan ke pertandingan lama.');setTimeout(()=>setNotice(''),3500);
      }catch{setNotice('CSV historis tidak terbaca.');}
    };reader.readAsText(file);e.target.value='';
  }

  function exportFullBackup(){
    const payload={app:'Football Analytics Lab',schemaVersion:1,createdAt:new Date().toISOString(),history,matches,betLog};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='football-analytics-lab-backup.json';a.click();URL.revokeObjectURL(url);
  }
  function importFullBackup(e){
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();reader.onload=()=>{
      try{
        const data=JSON.parse(String(reader.result||''));
        if(data.app!=='Football Analytics Lab'||data.schemaVersion!==1||!Array.isArray(data.history)||!Array.isArray(data.matches)||!Array.isArray(data.betLog))throw new Error('Format backup tidak cocok.');
        if(!window.confirm('Pulihkan backup? Data lokal saat ini akan diganti dengan isi file backup.'))return;
        setHistory(data.history);setMatches(data.matches);setBetLog(data.betLog);
        localStorage.setItem('fal_history',JSON.stringify(data.history));
        localStorage.setItem('fal_matches',JSON.stringify(data.matches));
        localStorage.setItem('fal_bet_log',JSON.stringify(data.betLog));
        setNotice('Backup berhasil dipulihkan.');setTimeout(()=>setNotice(''),3000);
      }catch(err){setNotice(err.message==='Format backup tidak cocok.'?err.message:'File backup rusak atau tidak valid.');setTimeout(()=>setNotice(''),3500);}
    };reader.readAsText(file);e.target.value='';
  }
  function exportHistoryCsv(){
    const rows=[['date','league','home_team','away_team','home_goals','away_goals','odds_home','odds_draw','odds_away','odds_over25','odds_under25'],...history.map(m=>[m.date,m.league,m.home,m.away,m.hg,m.ag,m.oddsHome??'',m.oddsDraw??'',m.oddsAway??'',m.oddsOver25??'',m.oddsUnder25??''])];
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
      {[['overview','▦','Dashboard'],['analysis','◎','Match Analysis'],['live','◉','Live Analysis'],['database','▤','Match Database'],['backtest','◷','Backtesting'],['bets','▣','Bet Tracker'],['tools','⌁','EV & Kelly']].map(([id,ic,label])=><button key={id} className={'nav-item '+(tab===id?'active':'')} onClick={()=>setTab(id)}><span>{ic}</span>{label}</button>)}
      <div className="sidebar-bottom"><span className="pulse"></span> LOCAL MODE <small>v1.0.0 MVP</small></div>
    </aside>
    <main className="main"><header className="topbar"><div><span className="eyebrow">FOOTBALL INTELLIGENCE / WORKSPACE</span><h1>{({overview:'Dashboard',analysis:'Match Analysis',database:'Match Database',tools:'EV & Kelly',backtest:'Backtesting',live:'Live Analysis',bets:'Bet Tracker'})[tab]}</h1></div><div className="top-actions"><span className="local-pill">● Offline-ready</span><div className="avatar">FA</div></div></header>
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
    {tab==='live'&&<><section className="panel"><div className="panel-head"><div><div className="eyebrow">IN-PLAY MANUAL MODEL</div><h3>Input kondisi pertandingan</h3></div><span className="tag">LIVE MODEL · BASIC</span></div>
      <p className="muted">Pilih tim dan pastikan lambda otomatis sudah tersedia di Match Analysis. Masukkan menit, skor berjalan, dan kartu merah untuk memperbarui estimasi peluang hingga akhir pertandingan.</p>
      <div className="form-grid">
        <Field label="MENIT PERTANDINGAN"><input type="number" min="0" max="90" value={liveMinute} onChange={e=>setLiveMinute(clamp(Number(e.target.value)||0,0,90))}/></Field>
        <Field label="SKOR KANDANG"><input type="number" min="0" max="20" value={liveHomeScore} onChange={e=>setLiveHomeScore(clamp(Number(e.target.value)||0,0,20))}/></Field>
        <Field label="SKOR TANDANG"><input type="number" min="0" max="20" value={liveAwayScore} onChange={e=>setLiveAwayScore(clamp(Number(e.target.value)||0,0,20))}/></Field>
        <Field label="KARTU MERAH KANDANG"><select value={liveHomeRed} onChange={e=>setLiveHomeRed(Number(e.target.value))}><option value="0">Tidak ada</option><option value="1">1 kartu merah</option></select></Field>
        <Field label="KARTU MERAH TANDANG"><select value={liveAwayRed} onChange={e=>setLiveAwayRed(Number(e.target.value))}><option value="0">Tidak ada</option><option value="1">1 kartu merah</option></select></Field>
      </div>
      {!home||!away||!lambdaEstimate?<div className="disclaimer">Pilih tim dan impor data historis yang cukup di Match Analysis terlebih dahulu agar lambda dasar tersedia.</div>:<div className="live-results">
        <div className="live-match-title"><b>{home}</b><strong>{liveHomeScore} — {liveAwayScore}</strong><b>{away}</b></div>
        <div className="live-lambda">Estimasi gol tersisa · {fmt(liveResult.liveHome,2)} kandang / {fmt(liveResult.liveAway,2)} tandang</div>
        <div className="prob-row"><Prob label="HOME WIN" value={liveResult.home}/><Prob label="DRAW" value={liveResult.draw}/><Prob label="AWAY WIN" value={liveResult.away}/></div>
        <div className="bar"><i style={{width:(liveResult.home*100)+'%'}}/><i style={{width:(liveResult.draw*100)+'%'}}/><i style={{width:(liveResult.away*100)+'%'}}/></div>
        <div className="market-grid live-market-grid">
          <div className="market-card"><h4>Final total goals 2.5</h4><div className="market-line"><span>Over 2.5</span><b>{fmt(liveResult.over25*100,2)}%</b></div><div className="market-line"><span>Under 2.5</span><b>{fmt(liveResult.under25*100,2)}%</b></div></div>
          <div className="market-card"><h4>Both teams to score</h4><div className="market-line"><span>BTTS Yes</span><b>{fmt(liveResult.btts*100,2)}%</b></div><div className="market-line"><span>BTTS No</span><b>{fmt((1-liveResult.btts)*100,2)}%</b></div></div>
        </div>
        <h4 className="backtest-heading">Skor akhir paling mungkin</h4>{liveResult.score.map((x,i)=><div className="score-line" key={i}><span className="rank">0{i+1}</span><b>{x.h} - {x.a}</b><div className="mini-track"><i style={{width:(x.p/liveResult.score[0].p*100)+'%'}}/></div><strong>{fmt(x.p*100,2)}%</strong></div>)}
      </div>}
      <div className="disclaimer">Model live dasar ini memakai lambda pre-match sebagai baseline, lalu menyesuaikan sisa waktu, kondisi tertinggal/unggul, dan kartu merah. Input live dilakukan manual; belum ada feed skor/odds real-time. Asumsi durasi normal 90 menit, belum memodelkan injury time, red card timing, pergantian pemain, atau perubahan tempo aktual.</div>
    </section></>}
    {tab==='backtest'&&<section className="panel"><div className="panel-head"><div><div className="eyebrow">OUT-OF-SAMPLE VALIDATION</div><h3>Walk-forward backtesting</h3></div><span className="tag">NO LOOK-AHEAD</span></div>
      <p className="muted">Setiap pertandingan diprediksi hanya memakai hasil historis yang tanggalnya lebih awal. Pertandingan pada tanggal yang sama tidak dipakai sebagai data latihan untuk satu sama lain. Pengujian dibatasi maksimal 500 pertandingan terbaru agar tetap ringan di Android.</p>
      <div className="button-row"><button className="primary" onClick={()=>setBacktest(runWalkForwardBacktest(history))}>Jalankan backtest</button><button className="secondary" onClick={()=>setBacktest(null)}>Reset hasil</button></div>
      {!history.length?<Empty text="Impor hasil pertandingan historis terlebih dahulu dari Match Database."/>:null}
      {backtest?.error&&<div className="disclaimer">{backtest.error}</div>}
      {backtest&&!backtest.error&&<>
        <div className="backtest-meta">Data bertanggal: {backtest.total.toLocaleString('id-ID')} · Pertandingan yang berhasil diuji: {backtest.tested.toLocaleString('id-ID')}</div>
        <div className="backtest-grid">
          <div className="market-card"><span>1X2 HIT RATE</span><b>{fmt(backtest.accuracy*100,2)}%</b></div>
          <div className="market-card"><span>1X2 LOG LOSS ↓</span><b>{fmt(backtest.logLoss,4)}</b></div>
          <div className="market-card"><span>1X2 BRIER SCORE ↓</span><b>{fmt(backtest.brier,4)}</b></div>
          <div className="market-card"><span>OVER/UNDER 2.5 HIT RATE</span><b>{fmt(backtest.ouAccuracy*100,2)}%</b></div>
          <div className="market-card"><span>O/U 2.5 BRIER SCORE ↓</span><b>{fmt(backtest.ouBrier,4)}</b></div>
        </div>
        <p className="muted tiny">Log loss dan Brier score makin rendah makin baik. Hit rate hanya proporsi tebakan yang tepat, bukan ukuran kalibrasi. Angka ini evaluasi historis, bukan jaminan hasil mendatang.</p>
        <h4 className="backtest-heading">Simulasi ROI berbasis odds historis</h4>
        {backtest.bets>0?<div className="backtest-grid">
          <div className="market-card"><span>JUMLAH BET</span><b>{backtest.bets.toLocaleString('id-ID')}</b></div>
          <div className="market-card"><span>WIN RATE</span><b>{fmt(backtest.winRate*100,2)}%</b></div>
          <div className="market-card"><span>ROI / YIELD</span><b className={backtest.roi>=0?'positive':'negative'}>{backtest.roi>=0?'+':''}{fmt(backtest.roi*100,2)}%</b></div>
          <div className="market-card"><span>PROFIT / LOSS</span><b className={backtest.profitUnits>=0?'positive':'negative'}>{backtest.profitUnits>=0?'+':''}{fmt(backtest.profitUnits,2)} unit</b></div>
          <div className="market-card"><span>RATA-RATA ODDS</span><b>{fmt(backtest.avgOdds,2)}</b></div>
          <div className="market-card"><span>RATA-RATA EV SAAT ENTRY</span><b>{fmt(backtest.avgEv*100,2)}%</b></div>
        </div>:<div className="disclaimer">Belum ada taruhan yang memenuhi syarat. Pastikan CSV historis memiliki odds valid di atas 1.00 untuk 1X2 dan/atau Over/Under 2.5. Strategi simulasi mengambil maksimal satu pilihan dengan EV tertinggi per pertandingan dan mensyaratkan EV di atas 3%.</div>}
        <h4 className="backtest-heading">Contoh pertandingan yang diuji</h4>
        <div className="table-wrap"><table><thead><tr><th>TANGGAL</th><th>PERTANDINGAN</th><th>SKOR</th><th>PREDIKSI 1X2</th><th>PROBABILITAS</th></tr></thead><tbody>{backtest.examples.map((m,i)=><tr key={i}><td>{m.date}</td><td>{m.home} vs {m.away}</td><td>{m.score}</td><td>{m.predicted}</td><td>{fmt(m.confidence*100,1)}%</td></tr>)}</tbody></table></div>
      </>}
      <div className="disclaimer">Catatan ROI: simulasi memakai odds historis yang diimpor, taruhan flat 1 unit, maksimal satu pilihan EV tertinggi per pertandingan, dan ambang EV di atas 3%. Belum memperhitungkan limit bandar, perubahan odds, komisi, closing-line value, atau biaya transaksi. Hasil historis bukan jaminan keuntungan. Model memakai rho tetap 0.06.</div>
    </section>}
    {tab==='bets'&&(()=>{const settled=betLog.filter(b=>b.status!=='open');const wins=settled.filter(b=>b.status==='win').length;const turnover=settled.filter(b=>b.status!=='void').reduce((s,b)=>s+b.stake,0);const profit=settled.reduce((s,b)=>s+(b.status==='win'?b.stake*(b.odds-1):b.status==='loss'?-b.stake:0),0);const open=betLog.filter(b=>b.status==='open').length;return <section className="panel"><div className="panel-head"><div><div className="eyebrow">REAL BET RECORDS</div><h3>Bet Tracker <span className="count">{betLog.length}</span></h3></div><button className="secondary" onClick={exportBetLog} disabled={!betLog.length}>Export CSV ↓</button></div><p className="muted">Catat taruhan aktual dan selesaikan hasilnya. P/L dihitung dari stake dan odds yang dicatat; taruhan terbuka belum masuk ROI.</p><div className="form-grid"><Field label="PERTANDINGAN"><input value={betFixture} onChange={e=>setBetFixture(e.target.value)} placeholder={home&&away?home+' vs '+away:'Contoh: Arsenal vs Chelsea'}/></Field><Field label="PILIHAN PASAR"><select value={betSelection} onChange={e=>setBetSelection(e.target.value)}><option>Home</option><option>Draw</option><option>Away</option><option>Over 2.5</option><option>Under 2.5</option><option>BTTS Yes</option><option>BTTS No</option><option>Asian Handicap</option><option>Other</option></select></Field><Field label="ODDS DECIMAL"><input type="number" min="1.01" step=".01" value={betOdds} onChange={e=>setBetOdds(e.target.value)}/></Field><Field label="STAKE (IDR)"><input type="number" min="1" step="1000" value={betStake} onChange={e=>setBetStake(e.target.value)}/></Field></div><button className="primary" onClick={addBet}>+ Catat taruhan</button><div className="backtest-grid"><div className="market-card"><span>TARUHAN SELESAI</span><b>{settled.length}</b></div><div className="market-card"><span>OPEN BETS</span><b>{open}</b></div><div className="market-card"><span>WIN RATE</span><b>{settled.filter(b=>b.status==='win'||b.status==='loss').length?fmt(wins/settled.filter(b=>b.status==='win'||b.status==='loss').length*100,1)+'%':'—'}</b></div><div className="market-card"><span>NET PROFIT / LOSS</span><b className={profit>=0?'positive':'negative'}>{profit>=0?'+':''}Rp {Math.round(profit).toLocaleString('id-ID')}</b></div><div className="market-card"><span>ROI</span><b className={profit>=0?'positive':'negative'}>{turnover?fmt(profit/turnover*100,2)+'%':'—'}</b></div></div>{betLog.length?<div className="table-wrap"><table><thead><tr><th>TANGGAL</th><th>PERTANDINGAN</th><th>PILIHAN</th><th>ODDS</th><th>STAKE</th><th>STATUS / AKSI</th></tr></thead><tbody>{betLog.map(b=><tr key={b.id}><td>{b.date}</td><td>{b.fixture}</td><td>{b.selection}</td><td>{fmt(b.odds,2)}</td><td>Rp {Number(b.stake).toLocaleString('id-ID')}</td><td>{b.status==='open'?<div className="button-row"><button className="primary" onClick={()=>settleBet(b.id,'win')}>Win</button><button className="secondary" onClick={()=>settleBet(b.id,'loss')}>Loss</button><button className="secondary" onClick={()=>settleBet(b.id,'void')}>Void</button></div>:<b className={b.status==='win'?'positive':b.status==='loss'?'negative':''}>{b.status.toUpperCase()}</b>}</td></tr>)}</tbody></table></div>:<Empty text="Belum ada catatan taruhan. Tambahkan taruhan aktual untuk mulai memantau performa."/>}<div className="disclaimer">P/L: Win = stake × (odds − 1), Loss = −stake, Void = 0. ROI dihitung dari total stake taruhan selesai selain void. Data tersimpan lokal di perangkat; ekspor CSV untuk backup. Tracker ini hanya pencatatan, bukan rekomendasi atau jaminan profit.</div></section>})()}
    {tab==='database'&&<section className="panel"><div className="panel-head"><div><div className="eyebrow">LOCAL DATASET</div><h3>Match database <span className="count">{matches.length}</span></h3></div><div className="button-row"><button className="secondary" onClick={exportFullBackup}>Full backup ↓</button><label className="secondary file-btn">Restore backup<input type="file" accept=".json,application/json" onChange={importFullBackup}/></label><label className="secondary file-btn">Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv}/></label><button className="secondary" onClick={exportCsv}>Export CSV ↓</button></div></div><div className="panel-subhead"><h3>Historical results <span className="count">{history.length}</span></h3><div className="button-row"><label className="secondary file-btn">Import historical CSV<input type="file" accept=".csv,text/csv" onChange={importHistoryCsv}/></label><button className="secondary" onClick={exportHistoryCsv} disabled={!history.length}>Export history ↓</button></div></div><p className="muted tiny">Format wajib: date, home_team, away_team, home_goals, away_goals. Opsional: league, odds_home, odds_draw, odds_away, odds_over25, odds_under25. Odds desimal, misalnya 2.10. Jika impor ulang hasil yang sama dengan odds baru, odds akan ditambahkan ke data lama.</p>{history.length?<div className="history-list">{history.slice(-8).reverse().map(m=><div className="history-row" key={m.id}><span>{m.date||"—"}</span><b>{m.home}</b><strong>{m.hg} - {m.ag}</strong><b>{m.away}</b></div>)}</div>:<Empty text="Belum ada hasil historis. Impor CSV untuk membangun basis data performa tim."/>}<div className="divider-line"/>{matches.length?<MatchTable rows={matches}/>:<Empty text="Database masih kosong. Simpan analisis atau impor CSV untuk mulai mengisi."/>}<p className="muted tiny">Data tersimpan lokal di perangkat ini. Gunakan Full backup untuk menyimpan riwayat pertandingan, analisis, dan Bet Tracker dalam satu file JSON. Simpan file backup di tempat aman secara berkala.</p></section>}
    {tab==='tools'&&<section className="panel"><div className="eyebrow">VALUE & STAKING</div><h3>Expected Value & Kelly</h3><p className="muted">Contoh kalkulator untuk pilihan Over 2.5 berdasarkan probabilitas model.</p><div className="form-grid"><Field label="ODDS DECIMAL"><input type="number" min="1.01" step=".01" value={odds} onChange={e=>setOdds(e.target.value)}/></Field><Field label="BANKROLL (IDR)"><input type="number" min="0" step="1000" value={stake} onChange={e=>setStake(e.target.value)}/></Field><Field label="FRACTIONAL KELLY"><select value={kellyFraction} onChange={e=>setKellyFraction(Number(e.target.value))}><option value=".25">¼ Kelly · konservatif</option><option value=".5">½ Kelly · moderat</option><option value="1">Full Kelly · agresif</option></select></Field><Field label="BATAS RISIKO PER BET"><select value={riskCap} onChange={e=>setRiskCap(Number(e.target.value))}><option value=".01">1% bankroll</option><option value=".02">2% bankroll</option><option value=".03">3% bankroll</option><option value=".05">5% bankroll</option></select></Field></div><div className="tool-results"><div><span>MODEL PROBABILITY · OVER 2.5</span><b>{fmt(p*100,2)}%</b></div><div><span>EXPECTED VALUE</span><b className={ev>=0?'positive':'negative'}>{ev>=0?'+':''}{fmt(ev*100,2)}%</b></div><div><span>FULL KELLY</span><b>{fmt(kelly*100,2)}%</b></div><div><span>FRACTIONAL KELLY</span><b>{fmt(kelly*Number(kellyFraction)*100,2)}%</b></div><div><span>BATAS MAKSIMUM BET</span><b>Rp {Math.round(capStake).toLocaleString('id-ID')}</b></div><div><span>REKOMENDASI STAKE</span><b>Rp {Math.round(recommendedStake).toLocaleString('id-ID')}</b></div><div><span>RISIKO EFEKTIF BANKROLL</span><b>{fmt(effectiveFraction*100,2)}%</b></div></div><div className="disclaimer">Stake rekomendasi = nilai Fractional Kelly yang dibatasi maksimum risiko per taruhan. Jika EV tidak positif, rekomendasi otomatis Rp 0. Kalkulator ini hanya contoh pasar Over 2.5 dan mengasumsikan odds desimal; kesalahan probabilitas model dapat membuat ukuran taruhan terlalu besar. Tidak ada taruhan yang bebas risiko.</div></section>}
    <footer>FOOTBALL ANALYTICS LAB <span>Built for disciplined analysis · {new Date().getFullYear()}</span></footer></main>
  </div>
}
function Stat({label,value,hint}){return <div className="stat-card"><span>{label}</span><b>{value}</b><small>{hint}</small></div>}
function Field({label,hint,children}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
function Prob({label,value}){return <div className="prob"><span>{label}</span><b>{fmt(value*100,1)}%</b></div>}
function MatchTable({rows}){return <div className="table-wrap"><table><thead><tr><th>DATE</th><th>HOME</th><th></th><th>AWAY</th><th>λ HOME</th><th>λ AWAY</th></tr></thead><tbody>{rows.map(m=><tr key={m.id}><td>{m.date||'—'}</td><td>{m.home}</td><td className="vs">vs</td><td>{m.away}</td><td>{m.lambda_home??'—'}</td><td>{m.lambda_away??'—'}</td></tr>)}</tbody></table></div>}
function Empty({text}){return <div className="empty"><span>▤</span><p>{text}</p></div>}
createRoot(document.getElementById('root')).render(<App/>);