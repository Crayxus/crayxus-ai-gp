// engine.js — 掼蛋-lite 1v1 单副牌引擎（纯逻辑，可在 node 自测，也供 game.html 使用）
(function(global){
  const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2']; // 0..12
  const SUITS = ['♠','♥','♦','♣'];

  function makeDeck(){
    const d=[];
    for(let r=0;r<RANKS.length;r++)
      for(let s=0;s<4;s++)
        d.push({r, label:RANKS[r], suit:SUITS[s], red:(s===1||s===2)});
    d.push({r:13,label:'小王',suit:'JOKER',red:false,joker:true});
    d.push({r:14,label:'大王',suit:'JOKER',red:true, joker:true});
    return d;
  }
  function shuffle(a){
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
    return a;
  }
  function groupByRank(cards){
    const m={};
    for(const c of cards){ (m[c.r]=m[c.r]||[]).push(c); }
    return m;
  }

  // 识别牌型 -> {type,len,value,cards} | null
  function detect(cards){
    if(!cards||cards.length===0) return null;
    const cs=[...cards].sort((a,b)=>a.r-b.r);
    const n=cs.length, ranks=cs.map(c=>c.r);
    const allSame=ranks.every(r=>r===ranks[0]);
    if(n===2 && cs[0].r===13 && cs[1].r===14) return {type:'rocket',len:2,value:100,cards:cs};
    if(allSame){
      if(n===1) return {type:'single',len:1,value:ranks[0],cards:cs};
      if(n===2) return {type:'pair',len:2,value:ranks[0],cards:cs};
      if(n===3) return {type:'trio',len:3,value:ranks[0],cards:cs};
      if(n>=4) return {type:'bomb',len:n,value:ranks[0],cards:cs};
    }
    if(n===5){
      const cnt={}; ranks.forEach(r=>cnt[r]=(cnt[r]||0)+1);
      const ks=Object.keys(cnt);
      const trio=ks.find(k=>cnt[k]===3), pair=ks.find(k=>cnt[k]===2);
      if(trio&&pair) return {type:'trio_pair',len:5,value:+trio,cards:cs};
    }
    if(n>=5){
      const distinct=new Set(ranks);
      if(distinct.size===n && ranks.every(r=>r<=11)){
        let ok=true;
        for(let i=1;i<n;i++) if(ranks[i]!==ranks[i-1]+1) ok=false;
        if(ok) return {type:'straight',len:n,value:ranks[n-1],cards:cs};
      }
    }
    return null;
  }

  function beats(cand, cur){
    if(!cand) return false;
    if(!cur) return true;
    if(cand.type==='rocket') return true;
    if(cur.type==='rocket') return false;
    if(cand.type==='bomb' && cur.type!=='bomb') return true;
    if(cand.type==='bomb' && cur.type==='bomb')
      return cand.len!==cur.len ? cand.len>cur.len : cand.value>cur.value;
    if(cur.type==='bomb' && cand.type!=='bomb') return false;
    return cand.type===cur.type && cand.len===cur.len && cand.value>cur.value;
  }

  // 枚举手里所有可出牌型
  function genMoves(hand){
    const out=[], by=groupByRank(hand);
    const rks=Object.keys(by).map(Number);
    for(const r of rks){
      const g=by[r];
      out.push(g.slice(0,1));
      if(g.length>=2) out.push(g.slice(0,2));
      if(g.length>=3) out.push(g.slice(0,3));
      if(g.length>=4) out.push(g.slice(0));            // 炸弹
    }
    const sj=hand.find(c=>c.r===13), bj=hand.find(c=>c.r===14);
    if(sj&&bj) out.push([sj,bj]);                       // 王炸
    // 顺子
    const rankSet=new Set(hand.filter(c=>c.r<=11).map(c=>c.r));
    let start=0;
    while(start<=11){
      if(!rankSet.has(start)){ start++; continue; }
      let run=[]; let k=start;
      while(k<=11 && rankSet.has(k)){ run.push(k); k++; }
      if(run.length>=5){
        for(let len=5;len<=run.length;len++)
          for(let off=0;off+len<=run.length;off++)
            out.push(run.slice(off,off+len).map(rr=>by[rr][0]));
      }
      start=k;
    }
    // 三带二
    for(const r of rks){
      if(by[r].length>=3)
        for(const r2 of rks)
          if(r2!==r && by[r2].length>=2)
            out.push([...by[r].slice(0,3), ...by[r2].slice(0,2)]);
    }
    return out.map(detect).filter(Boolean);
  }

  function leadMove(hand){
    const ms=genMoves(hand);
    const normal=ms.filter(m=>m.type!=='bomb'&&m.type!=='rocket');
    if(!normal.length) return ms.sort((a,b)=>a.len-b.len)[0]||null;
    const straights=normal.filter(m=>m.type==='straight').sort((a,b)=>b.len-a.len||a.value-b.value);
    const pairs=normal.filter(m=>m.type==='pair').sort((a,b)=>a.value-b.value);
    const trios=normal.filter(m=>m.type==='trio').sort((a,b)=>a.value-b.value);
    const singles=normal.filter(m=>m.type==='single').sort((a,b)=>a.value-b.value);
    if(straights[0]) return straights[0];
    if(pairs[0]) return pairs[0];
    if(trios[0]) return trios[0];
    if(singles[0]) return singles[0];
    return normal.sort((a,b)=>a.value-b.value)[0];
  }

  function followMove(hand, cur, oppCount){
    const ms=genMoves(hand).filter(m=>beats(m,cur));
    const normal=ms.filter(m=>m.type!=='bomb'&&m.type!=='rocket').sort((a,b)=>a.value-b.value);
    if(normal.length) return normal[0];
    const bombs=ms.filter(m=>m.type==='bomb').sort((a,b)=>a.len-b.len||a.value-b.value);
    const rocket=ms.find(m=>m.type==='rocket');
    if(bombs.length && oppCount<=6) return bombs[0];
    if(rocket && oppCount<=3) return rocket;
    return null; // 过
  }

  function removeCards(hand, combo){
    const set=new Set(combo.cards);
    return hand.filter(c=>!set.has(c));
  }

  const API={RANKS,SUITS,makeDeck,shuffle,detect,beats,genMoves,leadMove,followMove,removeCards,groupByRank};
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  global.GD=API;
})(typeof window!=='undefined'?window:globalThis);
