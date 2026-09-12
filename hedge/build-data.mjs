// 每日自动刷新 hedge 当天比赛数据。
// 设计在 GitHub Actions(美国 runner) 上跑：Node20 全局 fetch 直连 ESPN，无需代理。
// 抓当天真实赛程+真实欧赔+让分线 → 泊松/Skellam 还原 竞彩6×SP + bet365亚盘梯子 → 回写 index.html 的 /*DATA*/.../*ENDDATA*/ 段。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LEAGUES = [
  { slug:'fifa.friendly',         label:'国际友谊赛' },
  { slug:'uefa.nations',          label:'欧国联' },
  { slug:'fifa.worldq.uefa',      label:'世预赛·欧洲' },
  { slug:'fifa.worldq.conmebol',  label:'世预赛·南美' },
  { slug:'fifa.worldq.afc',       label:'世预赛·亚洲' },
  { slug:'fifa.worldq.concacaf',  label:'世预赛·中北美' },
  { slug:'fifa.worldq.caf',       label:'世预赛·非洲' },
  { slug:'fifa.world',            label:'世界杯' },
  { slug:'uefa.champions',        label:'欧冠' },
  { slug:'uefa.europa',           label:'欧联' },
  { slug:'eng.1',                 label:'英超' },
  { slug:'esp.1',                 label:'西甲' },
  { slug:'ita.1',                 label:'意甲' },
  { slug:'ger.1',                 label:'德甲' },
  { slug:'fra.1',                 label:'法甲' },
  { slug:'conmebol.america',      label:'美洲杯' },
  { slug:'conmebol.libertadores', label:'解放者杯' },
];

const CN = {
  'United States':'美国','Germany':'德国','Brazil':'巴西','Egypt':'埃及','Portugal':'葡萄牙','Chile':'智利',
  'Switzerland':'瑞士','Australia':'澳大利亚','Romania':'罗马尼亚','Wales':'威尔士','Belgium':'比利时','Tunisia':'突尼斯',
  'Venezuela':'委内瑞拉','Türkiye':'土耳其','Turkey':'土耳其','Bolivia':'玻利维亚','Scotland':'苏格兰','Panama':'巴拿马',
  'Bosnia-Herzegovina':'波黑','Bosnia and Herzegovina':'波黑','Armenia':'亚美尼亚','Kazakhstan':'哈萨克斯坦',
  'France':'法国','Spain':'西班牙','Italy':'意大利','England':'英格兰','Netherlands':'荷兰','Croatia':'克罗地亚',
  'Argentina':'阿根廷','Mexico':'墨西哥','Colombia':'哥伦比亚','Uruguay':'乌拉圭','Japan':'日本','South Korea':'韩国',
  'Korea Republic':'韩国','Morocco':'摩洛哥','Denmark':'丹麦','Poland':'波兰','Serbia':'塞尔维亚','Austria':'奥地利',
  'Sweden':'瑞典','Norway':'挪威','Ukraine':'乌克兰','Greece':'希腊','Hungary':'匈牙利','Czechia':'捷克','Ireland':'爱尔兰',
  'Republic of Ireland':'爱尔兰','Peru':'秘鲁','Ecuador':'厄瓜多尔','Paraguay':'巴拉圭','Nigeria':'尼日利亚','Senegal':'塞内加尔',
  'Ghana':'加纳','Cameroon':'喀麦隆','Ivory Coast':'科特迪瓦','Algeria':'阿尔及利亚','Iran':'伊朗','Saudi Arabia':'沙特',
  'Qatar':'卡塔尔','Iraq':'伊拉克','China PR':'中国','China':'中国','Canada':'加拿大','Costa Rica':'哥斯达黎加',
  'Honduras':'洪都拉斯','Jamaica':'牙买加','El Salvador':'萨尔瓦多','New Zealand':'新西兰','Finland':'芬兰','Slovakia':'斯洛伐克',
  'Slovenia':'斯洛文尼亚','Albania':'阿尔巴尼亚','Georgia':'格鲁吉亚','Israel':'以色列','Iceland':'冰岛','Luxembourg':'卢森堡',
  // 常见俱乐部
  'Real Madrid':'皇马','Barcelona':'巴塞罗那','Manchester City':'曼城','Manchester United':'曼联','Liverpool':'利物浦',
  'Arsenal':'阿森纳','Chelsea':'切尔西','Tottenham Hotspur':'热刺','Bayern Munich':'拜仁','Borussia Dortmund':'多特蒙德',
  'Juventus':'尤文图斯','Inter Milan':'国际米兰','AC Milan':'AC米兰','Napoli':'那不勒斯','Paris Saint-Germain':'巴黎圣日耳曼',
  'Atletico Madrid':'马竞','Boca Juniors':'博卡青年','River Plate':'河床','Flamengo':'弗拉门戈','Palmeiras':'帕尔梅拉斯',
};
const cn = n => CN[n] || n;

const dec = ml => ml > 0 ? ml/100 + 1 : 100/(-ml) + 1;
function fact(n){ let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
function pois(l,k){ return Math.exp(-l)*Math.pow(l,k)/fact(k); }
function diffDist(lh,la){ const m={};
  for(let i=0;i<=12;i++) for(let j=0;j<=12;j++){ const k=i-j; m[k]=(m[k]||0)+pois(lh,i)*pois(la,j); } return m; }
const Pge=(m,T)=>{ let s=0; for(const k in m) if(+k>=T) s+=m[k]; return s; };
const Ple=(m,T)=>{ let s=0; for(const k in m) if(+k<=T) s+=m[k]; return s; };
const Peq=(m,T)=> m[T]||0;
const Mjc=1.105, Mb=1.045, r2=x=>Math.round(x*100)/100;
const LADDER_T=[3,2,1,0,-1,-2];
function jcNoise(){ let n=(Math.random()-0.5)*0.04; if(Math.random()<0.20) n+=0.05+Math.random()*0.09; return 1+n; }

// 套利注入：临界场把对应竞彩热门腿轻抬至 101~103.5%。div=1 单关; div=搭档水位 时按串关(2串1)等效赔率注入
function injectArb(m, div){
  const ah=m.b3.ah, getAH=T=>ah.find(x=>x.T===T), Hf=m.jc.hcp.line;
  const singles=[
    {set:v=>m.jc.spf.w=v, odds:m.jc.spf.w, comp:(getAH(1)||{}).away},
    {set:v=>m.jc.hcp.w=v, odds:m.jc.hcp.w, comp:(getAH(1-Hf)||{}).away},
    {set:v=>m.jc.spf.l=v, odds:m.jc.spf.l, comp:(getAH(0)||{}).home},
    {set:v=>m.jc.hcp.l=v, odds:m.jc.hcp.l, comp:(getAH(-Hf)||{}).home}
  ].filter(s=>s.comp);
  let best=null;
  singles.forEach(s=>{ const eff=s.odds/div, pay=1/(1/eff+1/s.comp); if(!best||pay>best.pay) best={s,pay}; });
  if(!best) return;
  const isParlay = div>1;
  const gate = isParlay ? 0.90 : 0.965;                 // 串关税重 → 放宽近套利门槛
  const fire = best.pay>gate && best.pay<1 && (!isParlay || Math.random()<0.5);  // 串关约半数近套利场注入
  if(fire){
    const target=1.012+Math.random()*0.023, newEff=1/(1/target - 1/best.s.comp), nv=r2(newEff*div);
    if(nv>best.s.odds && nv<25) best.s.set(nv);
  }
}

async function getJSON(url){
  try{ const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}}); if(!r.ok) return null; return await r.json(); }
  catch(e){ return null; }
}

function modelMatch(meta, comp, o){
  const homeC = (comp.competitors||[]).find(x=>x.homeAway==='home');
  const awayC = (comp.competitors||[]).find(x=>x.homeAway==='away');
  if(!homeC||!awayC) return null;
  const hML=o.homeTeamOdds&&o.homeTeamOdds.moneyLine, aML=o.awayTeamOdds&&o.awayTeamOdds.moneyLine, dML=o.drawOdds&&o.drawOdds.moneyLine;
  if(hML==null||aML==null||dML==null) return null;
  const x2={ h:r2(dec(hML)), d:r2(dec(dML)), a:r2(dec(aML)) };
  const pH=1/x2.h, pA=1/x2.a;
  if(Math.max(pH,pA) > 0.88) return null;              // 太悬殊(让2/让3)跳过，保持组合有意义

  const homeFav = hML < aML;                            // 美式赔率更负=热门
  const spread = Math.abs(o.spread||0.5);
  const OU = o.overUnder || 2.5;
  const homeLine = homeFav ? -spread : spread;
  const S = -homeLine;
  let lh=Math.max(0.2,(OU+S)/2), la=Math.max(0.2,(OU-S)/2);
  const m = diffDist(lh,la);

  const Hf = (Math.abs(S)>=2.0 ? 2 : 1) * (S>=0 ? -1 : 1);   // 竞彩让球数 ±1/±2

  const pW=Pge(m,1), pD=Peq(m,0), pL=Ple(m,-1);
  const pHW=Pge(m,1-Hf), pHD=Peq(m,-Hf), pHL=Ple(m,-1-Hf);
  const sp = p => r2(jcNoise()/(p*Mjc));
  const jc = { spf:{ w:sp(pW), d:sp(pD), l:sp(pL) }, hcp:{ line:Hf, w:sp(pHW), d:sp(pHD), l:sp(pHL) } };

  const ah = LADDER_T.map(T => { const ph=Pge(m,T), pa=Ple(m,T-1);
    return { T, line:r2(0.5-T), home:r2(1/(ph*Mb)), away:r2(1/(pa*Mb)) };
  }).filter(x => x.home>=1.08 && x.away>=1.08 && x.home<=9 && x.away<=9);

  const d=new Date(meta.date), bj=new Date(d.getTime()+8*3600*1000), pad=n=>String(n).padStart(2,'0');
  const time=pad(bj.getUTCMonth()+1)+'-'+pad(bj.getUTCDate())+' '+pad(bj.getUTCHours())+':'+pad(bj.getUTCMinutes());
  return { league:meta.label, time, ts:d.getTime(), dan:false,   // 默认非单关(走2串1串关); 可在界面点徽章切单关
    home:cn(homeC.team.displayName), away:cn(awayC.team.displayName), jc, b3:{ x2, ah } };
}

export async function buildMatches(){
  const now=new Date(), bj=new Date(now.getTime()+8*3600*1000);
  const dateStr=`${bj.getUTCFullYear()}${String(bj.getUTCMonth()+1).padStart(2,'0')}${String(bj.getUTCDate()).padStart(2,'0')}`;
  const picked=[]; const seen=new Set();
  for(const lg of LEAGUES){
    if(picked.length>=12) break;
    const sb=await getJSON(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.slug}/scoreboard?dates=${dateStr}`);
    if(!sb||!sb.events) continue;
    for(const e of sb.events){
      if(picked.length>=12) break;
      const st=e.status&&e.status.type&&e.status.type.state;
      if(st && st!=='pre') continue;                    // 只取未开赛(赛后/进行中没盘/套利无意义)
      const comp=e.competitions&&e.competitions[0]; if(!comp) continue;
      const key=e.name+'|'+e.date; if(seen.has(key)) continue;
      const od=await getJSON(`https://sports.core.api.espn.com/v2/sports/soccer/leagues/${lg.slug}/events/${e.id}/competitions/${e.id}/odds`);
      const o=od&&od.items&&od.items[0]; if(!o) continue;
      const mt=modelMatch({label:lg.label,date:e.date}, comp, o);
      if(mt){ picked.push(mt); seen.add(key); }
    }
  }
  // 套利注入：单关按单场, 非单关按串关(搭档=其他场最低水位)
  picked.forEach((m,i)=>{
    let pm=Infinity;
    picked.forEach((b,j)=>{ if(j===i) return; const mm=1/b.jc.spf.w+1/b.jc.spf.d+1/b.jc.spf.l; if(mm<pm) pm=mm; });
    injectArb(m, m.dan ? 1 : (isFinite(pm)?pm:1));
  });
  picked.sort((a,b)=>a.time<b.time?-1:1);
  return picked;
}

export async function main({ htmlPath, outPath }){
  const matches=await buildMatches();
  console.log('发现可用比赛:', matches.length);
  if(matches.length<1){ console.error('今日无可用比赛, 跳过写入(保留现有数据)'); return { written:false, count:matches.length }; }
  const html=readFileSync(htmlPath,'utf8');
  if(!/\/\*DATA\*\/[\s\S]*?\/\*ENDDATA\*\//.test(html)) throw new Error('index.html 缺少 /*DATA*/.../*ENDDATA*/ 标记');
  const line='/*DATA*/var MATCHES = '+JSON.stringify(matches)+';/*ENDDATA*/';
  writeFileSync(outPath||htmlPath, html.replace(/\/\*DATA\*\/[\s\S]*?\/\*ENDDATA\*\//, line));
  console.log('已写入', (outPath||htmlPath), ' ', matches.length, '场');
  return { written:true, count:matches.length };
}

// 直接运行(node hedge/build-data.mjs)时执行；被 import 测试时不自动跑
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href){
  const htmlPath=fileURLToPath(new URL('./index.html', import.meta.url));
  main({ htmlPath }).catch(e=>{ console.error(e); process.exit(1); });
}
