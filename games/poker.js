// poker.js — 1v1 无限注德州扑克引擎（纯逻辑，可 node 自测 / 供 texas.html 使用）
(function(global){
  const SUITS=['♠','♥','♦','♣'];
  function makeDeck(){
    const d=[];
    for(let r=2;r<=14;r++) for(let s=0;s<4;s++)
      d.push({r,s,label:rankLabel(r),suit:SUITS[s],red:(s===1||s===2)});
    return d;
  }
  function rankLabel(r){return r<=10?String(r):({11:'J',12:'Q',13:'K',14:'A'}[r]);}
  function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

  // ---- 7 张取最优 5 张：返回可比较的分数数组 [类别, 关键牌...] ----
  function straightHigh(rks){
    const set=new Set(rks); if(set.has(14)) set.add(1);
    let run=0;
    for(let r=14;r>=1;r--){ if(set.has(r)){run++; if(run>=5) return r+4;} else run=0; }
    return 0;
  }
  function evaluate7(cards){
    const bySuit={}, byRank={};
    for(const c of cards){ (bySuit[c.s]=bySuit[c.s]||[]).push(c.r); byRank[c.r]=(byRank[c.r]||0)+1; }
    // 同花顺
    let sf=0;
    for(const s in bySuit){ if(bySuit[s].length>=5){ const hi=straightHigh(bySuit[s]); if(hi>sf) sf=hi; } }
    if(sf) return [8, sf];
    const ranks=Object.keys(byRank).map(Number);
    const quad=ranks.filter(r=>byRank[r]===4).sort((a,b)=>b-a);
    if(quad.length){ const k=ranks.filter(r=>r!==quad[0]).sort((a,b)=>b-a)[0]||0; return [7,quad[0],k]; }
    const trips=ranks.filter(r=>byRank[r]===3).sort((a,b)=>b-a);
    const pairs=ranks.filter(r=>byRank[r]===2).sort((a,b)=>b-a);
    if(trips.length>=2) return [6,trips[0],trips[1]];
    if(trips.length&&pairs.length) return [6,trips[0],pairs[0]];
    for(const s in bySuit){ if(bySuit[s].length>=5){ const t5=bySuit[s].slice().sort((a,b)=>b-a).slice(0,5); return [5,...t5]; } }
    const sh=straightHigh(ranks);
    if(sh) return [4,sh];
    if(trips.length){ const ks=ranks.filter(r=>r!==trips[0]).sort((a,b)=>b-a).slice(0,2); return [3,trips[0],...ks]; }
    if(pairs.length>=2){ const k=ranks.filter(r=>r!==pairs[0]&&r!==pairs[1]).sort((a,b)=>b-a)[0]||0; return [2,pairs[0],pairs[1],k]; }
    if(pairs.length){ const ks=ranks.filter(r=>r!==pairs[0]).sort((a,b)=>b-a).slice(0,3); return [1,pairs[0],...ks]; }
    return [0,...ranks.slice().sort((a,b)=>b-a).slice(0,5)];
  }
  const CATS=['高牌','一对','两对','三条','顺子','同花','葫芦','四条','同花顺'];
  function catName(score){return CATS[score[0]];}
  function cmp(a,b){ const n=Math.max(a.length,b.length); for(let i=0;i<n;i++){ const x=a[i]||0,y=b[i]||0; if(x!==y) return x-y; } return 0; }

  // ---- 牌力 0..1（粗略估计，给 AI 用）----
  function preflopStrength(hole){
    const [a,b]=hole.map(c=>c.r).sort((x,y)=>y-x);
    const suited=hole[0].s===hole[1].s, gap=a-b;
    let s=(a+b)/56;                 // 高牌权重
    if(a===b) s=0.5+a/28;           // 口袋对
    if(suited) s+=0.08;
    if(gap===1) s+=0.06; else if(gap===2) s+=0.03;
    if(a===14) s+=0.05;
    return Math.max(0.05,Math.min(0.98,s));
  }
  function strength(hole, board){
    if(board.length===0) return preflopStrength(hole);
    const sc=evaluate7(hole.concat(board));
    const base=[0.18,0.40,0.58,0.70,0.80,0.85,0.92,0.97,0.99][sc[0]];
    return Math.min(0.99, base + (sc[1]||0)/400);
  }

  // ====== 1v1 无限注德扑 状态机 ======
  // 平注：SB=button 先行动(翻前)，翻后非button(BB)先行动
  function newHand(prev, SB=10, BB=20, START=1000){
    const st = prev || {button:1, stacks:[START,START], hand:0, sb:SB, bb:BB};
    st.button = 1-st.button;                       // 轮庄
    st.hand++;
    const deck=shuffle(makeDeck());
    st.deck=deck;
    st.board=[];
    st.street=0;                                   // 0翻前 1翻牌 2转牌 3河牌
    st.pot=0;                                       // 已结算入池(往轮)
    st.over=false; st.winner=null; st.msg='';
    st.p=[ {hole:[deck.pop(),deck.pop()], inStreet:0, acted:false, folded:false, allin:false},
           {hole:[deck.pop(),deck.pop()], inStreet:0, acted:false, folded:false, allin:false} ];
    // 下盲注（button=小盲）
    const sbP=st.button, bbP=1-st.button;
    post(st,sbP,SB); post(st,bbP,BB);
    st.currentBet=BB; st.minRaise=BB;
    st.toAct=sbP;                                   // 翻前 button 先动
    st.lastAggressor=bbP;
    return st;
  }
  function post(st,i,amt){ const pl=st.p[i]; const a=Math.min(amt,st.stacks[i]); st.stacks[i]-=a; pl.inStreet+=a; if(st.stacks[i]===0)pl.allin=true; }
  function livePot(st){ return st.pot + st.p[0].inStreet + st.p[1].inStreet; }
  function toCall(st,i){ return Math.max(0, st.currentBet - st.p[i].inStreet); }

  function legal(st){
    const i=st.toAct, pl=st.p[i], tc=toCall(st,i), stack=st.stacks[i], acts=[];
    if(st.over) return acts;
    if(tc>0) acts.push({type:'fold'});
    if(tc===0) acts.push({type:'check'});
    if(tc>0) acts.push({type:'call', amount:Math.min(tc,stack)});
    // 加注/下注
    if(stack>tc){
      const minTo = st.currentBet>0 ? st.currentBet+st.minRaise : st.bb;
      const maxTo = pl.inStreet+stack;             // all-in 上限
      acts.push({type: st.currentBet>0?'raise':'bet', min:Math.min(minTo,maxTo), max:maxTo});
    }
    return acts;
  }

  function apply(st, act){
    const i=st.toAct, pl=st.p[i];
    if(act.type==='fold'){ pl.folded=true; endHand(st, 1-i, '弃牌'); return st; }
    if(act.type==='check'){ pl.acted=true; }
    else if(act.type==='call'){ post(st,i,toCall(st,i)); pl.acted=true; }
    else if(act.type==='bet'||act.type==='raise'){
      const target=Math.max(act.amount, st.currentBet+ (st.currentBet>0?st.minRaise:st.bb));
      const cap=pl.inStreet+st.stacks[i];
      const to=Math.min(target,cap);
      const raiseSize=to-st.currentBet;
      post(st,i, to-pl.inStreet);
      if(raiseSize>0) st.minRaise=Math.max(st.minRaise, raiseSize);
      st.currentBet=Math.max(st.currentBet,to);
      pl.acted=true; st.p[1-i].acted=false; st.lastAggressor=i;
    }
    if(st.over) return st;
    // 是否结束本轮下注
    const both=st.p[0], other=st.p[1];
    const allActed = pl.acted && (st.p[1-i].acted || st.p[1-i].folded || st.p[1-i].allin);
    const betsEqual = st.p[0].inStreet===st.p[1].inStreet || st.p[0].allin || st.p[1].allin;
    if(allActed && betsEqual){ endStreet(st); }
    else { st.toAct = 1-i; }
    return st;
  }

  function endStreet(st){
    st.pot += st.p[0].inStreet + st.p[1].inStreet;
    st.p[0].inStreet=0; st.p[1].inStreet=0;
    st.currentBet=0; st.minRaise=st.bb; st.p[0].acted=false; st.p[1].acted=false;
    if(st.street>=3) return showdown(st);                  // 河牌下注完 → 摊牌
    const anyAllin = st.p[0].allin||st.p[1].allin;
    if(anyAllin){ while(st.street<3){ st.street++; dealBoard(st); } return showdown(st); }
    st.street++; dealBoard(st);
    st.toAct = 1-st.button;                                 // 翻后非 button 先动
  }
  function dealBoard(st){
    if(st.street===1){ st.board.push(st.deck.pop(),st.deck.pop(),st.deck.pop()); }
    else if(st.street===2||st.street===3){ st.board.push(st.deck.pop()); }
  }
  function showdown(st){
    // 补满公共牌
    while(st.board.length<5) st.board.push(st.deck.pop());
    const s0=evaluate7(st.p[0].hole.concat(st.board)), s1=evaluate7(st.p[1].hole.concat(st.board));
    const c=cmp(s0,s1);
    if(c>0) endHand(st,0,'摊牌 · '+catName(s0));
    else if(c<0) endHand(st,1,'摊牌 · '+catName(s1));
    else endHand(st,-1,'平分');
    st.showCards=true;
  }
  function endHand(st, winner, msg){
    const pot=livePot(st);
    if(winner===-1){ st.stacks[0]+=Math.floor(pot/2); st.stacks[1]+=Math.ceil(pot/2); }
    else st.stacks[winner]+=pot;
    st.pot=0; st.p[0].inStreet=0; st.p[1].inStreet=0;
    st.over=true; st.winner=winner; st.msg=msg; st.potWon=pot;
  }

  // ---- AI 决策 ----
  // 浏览器里直接算真实胜率（蒙特卡洛，用 evaluate7），无需后端
  function equityJS(hole, board, iters){
    iters = iters || (board.length ? 280 : 360);
    const used={}; for(const c of hole.concat(board)) used[c.r*4+c.s]=1;
    const deck=[]; for(let r=2;r<=14;r++) for(let s=0;s<4;s++){ const id=r*4+s; if(!used[id]) deck.push({r,s}); }
    const need=5-board.length; let win=0,tie=0;
    for(let it=0; it<iters; it++){
      for(let k=0;k<2+need;k++){ const j=k+Math.floor(Math.random()*(deck.length-k)); const t=deck[k]; deck[k]=deck[j]; deck[j]=t; }
      const opp=[deck[0],deck[1]], b=board.concat(deck.slice(2,2+need));
      const c=cmp(evaluate7(hole.concat(b)), evaluate7(opp.concat(b)));
      if(c>0) win++; else if(c===0) tie++;
    }
    return (win+tie*0.5)/iters;
  }
  function botAct(st){
    const i=st.toAct, acts=legal(st), pl=st.p[i];
    if(!acts.length) return null;
    const eq=Math.max(0.02,Math.min(0.99, equityJS(pl.hole, st.board) + (Math.random()-0.5)*0.06));
    const pot=livePot(st), tc=toCall(st,i), stack=st.stacks[i];
    const canRaise=acts.find(a=>a.type==='raise'||a.type==='bet');
    const r=Math.random();
    const rz=frac=>clampBet(st,canRaise, pot*frac);
    if(tc===0){
      if(eq>0.64 && canRaise) return {type:canRaise.type, amount:rz(0.55+r*0.4), eq};
      if(eq>0.48 && r<0.45 && canRaise) return {type:canRaise.type, amount:rz(0.4), eq};
      if(r<0.10 && canRaise) return {type:canRaise.type, amount:rz(0.5), eq}; // 偷鸡
      return {type:'check', eq};
    } else {
      const odds=tc/(pot+tc);
      if(eq>0.80 && canRaise && r<0.7) return {type:canRaise.type, amount:rz(0.7+r), eq};
      if(eq>odds+0.06) return {type:'call', amount:Math.min(tc,stack), eq};
      if(r<0.06 && canRaise) return {type:canRaise.type, amount:rz(0.7), eq}; // 诈唬
      return {type:'fold', eq};
    }
  }
  function clampBet(st,a,amt){ return Math.round(Math.max(a.min, Math.min(a.max, amt + st.currentBet))); }

  const API={makeDeck,shuffle,evaluate7,cmp,catName,strength,newHand,legal,apply,botAct,livePot,toCall,rankLabel};
  if(typeof module!=='undefined'&&module.exports) module.exports=API;
  global.PK=API;
})(typeof window!=='undefined'?window:globalThis);
