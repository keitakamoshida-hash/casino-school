import {red, rouletteReturn} from './engine.js';

export const CHIP_VALUES = [100, 500, 1000, 5000, 10000];
export const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const fmt = n => n.toLocaleString('ja-JP');
const short = n => n >= 10000 ? `${n/10000}万` : n >= 1000 ? `${n/1000}k` : String(n);
export const SPOTS = Object.fromEntries([
  ...Array.from({length:37}, (_,n) => [`n${n}`, {label:String(n), type:'number', number:n, multiplier:36}]),
  ...[['low','1–18'],['even','偶数'],['red','赤'],['black','黒'],['odd','奇数'],['high','19–36']].map(([key,label]) => [key,{label,type:key,multiplier:2}]),
  ...[1,2,3].map(n => [`dozen${n}`,{label:`${(n-1)*12+1}–${n*12}`,type:'dozen',number:n,multiplier:3}]),
  ...[1,2,3].map(n => [`column${n}`,{label:`${n}列（${n}, ${n+3}, …）`,type:'column',number:n,multiplier:3}]),
]);
export function initRoulette(s) {
  s.rouletteBets ??= [];
  s.rouletteChip = CHIP_VALUES.includes(s.rouletteChip) ? s.rouletteChip : 1000;
  s.rouletteRecent ??= [];
}
export const totalBet = s => s.rouletteBets.reduce((sum,b) => sum+b.amount,0);
export function placeChip(s,spot,amount=s.rouletteChip) {
  if(s.rouletteSpin)throw Error('回転中はベットを変更できません。');
  if (!Object.hasOwn(SPOTS,spot)||!CHIP_VALUES.includes(amount)) throw Error('チップと賭け先を選んでください。');
  if (s.balance < amount) throw Error('コインが足りません。小さいチップを選ぶか、置いたチップを戻してください。');
  if (totalBet(s)+amount>1000000) throw Error('1回のベット上限は1,000,000コインです。');
  s.balance -= amount;
  s.rouletteBets.push({spot,amount});
}
export function undoChip(s) {if(s.rouletteSpin)throw Error('回転中はベットを変更できません。');const b=s.rouletteBets.pop();if(b)s.balance+=b.amount;}
export function clearChips(s) {if(s.rouletteSpin)throw Error('回転中はベットを変更できません。');s.balance+=totalBet(s);s.rouletteBets=[];}
export function repeatChips(s) {
  if(s.rouletteSpin)throw Error('回転中はベットを変更できません。');
  const previous=s.roulettePrevious||[];
  if(s.rouletteBets.length)throw Error('前回と同じベットを置くには、先にマットをクリアしてください。');
  const total=previous.reduce((sum,b)=>sum+b.amount,0);
  if(total>s.balance)throw Error('前回と同じベットを置くコインが足りません。');
  s.balance-=total;s.rouletteBets=previous.map(b=>({...b}));
}
export function spotReturn(n,spot,amount) {
  const b=SPOTS[spot];
  if(!b||!Number.isInteger(n)||n<0||n>36)throw Error('ルーレットの賭け先または出目が不正です。');
  if(b.type==='dozen')return n>0&&Math.ceil(n/12)===b.number?amount*3:0;
  if(b.type==='column')return n>0&&((n-1)%3)+1===b.number?amount*3:0;
  return rouletteReturn(n,b.type,amount,b.number);
}
export const SPIN_DURATION = 5200;
export function startRouletteSpin(s,n,now=Date.now()) {
  if(s.rouletteSpin)throw Error('ルーレットは回転中です。');
  if(!totalBet(s))throw Error('マットにチップを置いてから回してください。');
  if(!Number.isInteger(n)||n<0||n>36)throw Error('不正な出目です。');
  const from=s.rouletteAngle||0,target=-WHEEL_ORDER.indexOf(n)*360/37;
  const to=from+1800+((target-from)%360+360)%360;
  s.rouletteSpin={n,started:now,ends:now+SPIN_DURATION,from,to};
}
export function finishRouletteSpin(s,now=Date.now()) {
  if(!s.rouletteSpin||now<s.rouletteSpin.ends)return null;
  const spin=s.rouletteSpin;
  s.rouletteSpin=null;
  const round=settleRoulette(s,spin.n);
  s.rouletteAngle=spin.to%360;
  return round;
}
export function settleRoulette(s,n) {
  const total=totalBet(s);
  if(!total)throw Error('マットにチップを置いてから回してください。');
  const groups={};for(const b of s.rouletteBets)groups[b.spot]=(groups[b.spot]||0)+b.amount;
  const details=Object.entries(groups).map(([spot,amount])=>({spot,amount,returned:spotReturn(n,spot,amount)}));
  const returned=details.reduce((sum,b)=>sum+b.returned,0);
  s.balance+=returned;s.lastNumber=n;
  s.roulettePrevious=s.rouletteBets.map(b=>({...b}));s.rouletteBets=[];
  s.rouletteRecent.unshift(n);s.rouletteRecent=s.rouletteRecent.slice(0,12);
  return s.rouletteRound={n,total,returned,delta:returned-total,details};
}
function marker(amount) {return `<span class="placed-chip" aria-hidden="true">${short(amount)}</span>`;}
function spot(s,key,label,style,cls='') {
  const amount=s.rouletteBets.filter(b=>b.spot===key).reduce((sum,b)=>sum+b.amount,0);
  const win=!s.rouletteSpin&&s.rouletteRound&&spotReturn(s.rouletteRound.n,key,1)>0;
  return `<button type="button" class="bet-spot ${cls} ${win?'last-win':''}" data-spot="${key}" ${s.rouletteSpin?'disabled':''} style="${style}" aria-label="${SPOTS[key].label}に賭ける${amount?`、${fmt(amount)}コイン配置済み`:''}" title="${SPOTS[key].label} · 払戻し${SPOTS[key].multiplier}倍"><span>${label}</span>${amount?marker(amount):''}</button>`;
}
function wheel(s) {
  const n=s.lastNumber??0,step=360/37,rotation=s.rouletteAngle??-WHEEL_ORDER.indexOf(n)*step;
  const spin=s.rouletteSpin,elapsed=spin?Math.min(SPIN_DURATION,Math.max(0,Date.now()-spin.started)):0;
  const motion=spin?`--wheel-from:${spin.from}deg;--wheel-to:${spin.to}deg;--spin-delay:-${elapsed}ms;--spin-duration:${SPIN_DURATION}ms;`:'';
  const sectors=WHEEL_ORDER.map((v,i)=>{
    const angle=(i*step-90)*Math.PI/180,x=150+118*Math.cos(angle),y=150+118*Math.sin(angle);
    const a=(i*step-step/2-90)*Math.PI/180,b=(i*step+step/2-90)*Math.PI/180;
    return `<path d="M150 150 L${150+143*Math.cos(a)} ${150+143*Math.sin(a)} A143 143 0 0 1 ${150+143*Math.cos(b)} ${150+143*Math.sin(b)} Z" fill="${v===0?'#337b53':red.has(v)?'#ad403a':'#17251e'}" stroke="#bda172" stroke-width=".6"/><text x="${x}" y="${y}" transform="rotate(${i*step},${x},${y})" text-anchor="middle" dominant-baseline="central" fill="#faf0d7" font-size="10" font-weight="600">${v}</text>`;
  }).join('');
  return `<div class="roulette-wheel ${spin?'is-spinning':''}" style="${motion}" aria-label="前回の出目 ${s.lastNumber??'未実施'}"><span class="wheel-pointer"></span><div class="ball-orbit" aria-hidden="true"><span class="roulette-ball"></span></div><svg viewBox="0 0 300 300" aria-hidden="true" style="transform:rotate(${rotation}deg)">${sectors}<circle cx="150" cy="150" r="94" fill="#70492d" stroke="#d8b873" stroke-width="4"/><circle cx="150" cy="150" r="78" fill="#223a2b" stroke="#aa8b54" stroke-width="2"/></svg><div class="wheel-center"><small>${spin?'SPINNING':'LAST NUMBER'}</small><strong class="${s.lastNumber===0?'zero-text':red.has(s.lastNumber)?'red-text':''}">${spin?'?':s.lastNumber??'—'}</strong><span>${spin?'NO MORE BETS':'EUROPEAN'}</span></div></div>`;
}
export function rouletteTable(s) {
  const total=totalBet(s),round=s.rouletteRound,busy=!!s.rouletteSpin;
  let grid=spot(s,'n0','0','grid-column:1;grid-row:1 / 4','zero');
  for(let row=0;row<3;row++){
    for(let col=0;col<12;col++){const n=3-row+col*3;grid+=spot(s,`n${n}`,n,`grid-column:${col+2};grid-row:${row+1}`,red.has(n)?'number-red':'number-black');}
    grid+=spot(s,`column${3-row}`,'2:1',`grid-column:14;grid-row:${row+1}`,'column-bet');
  }
  for(let i=1;i<=3;i++)grid+=spot(s,`dozen${i}`,`${i===1?'1st':i===2?'2nd':'3rd'} 12`,`grid-column:${2+(i-1)*4} / span 4;grid-row:4`,'outside');
  ['low','even','red','black','odd','high'].forEach((key,i)=>grid+=spot(s,key,key==='red'?'◆':key==='black'?'◆':SPOTS[key].label,`grid-column:${2+i*2} / span 2;grid-row:5`,`outside ${key==='red'?'red-diamond':key==='black'?'black-diamond':''}`));
  return `<div class="roulette-title"><div><span class="eyebrow">THE ROULETTE ROOM</span><h2>チップを置いて、運を試す。</h2></div><span class="pill">SINGLE ZERO · 0–36</span></div>
    <div class="rotate-tip">↻ スマホを横にすると、マット全体が見やすくなります。</div>
    <div class="roulette-arena"><div class="wheel-panel">${wheel(s)}<div class="recent-numbers" aria-label="過去の出目">${s.rouletteRecent.slice(0,7).map(n=>`<span class="${n===0?'zero':red.has(n)?'number-red':'number-black'}">${n}</span>`).join('')||'<small>最初のスピンを待っています</small>'}</div><p class="wheel-note">37の数字。どの数字も同じ確率。</p></div>
    <div class="mat-panel"><div class="mat-label"><span>${busy?'NO MORE BETS · 回転中':'PLACE YOUR BETS'}</span><span>数字 36倍 / 列・12数字 3倍 / 外側 2倍</span></div><div class="mat-scroll" tabindex="0" role="region" aria-label="ルーレットのベットマット。狭い画面では横にスクロールできます"><div class="betting-mat">${grid}</div></div><div class="mat-instruction">チップをドラッグ、または金額を選んでマスをタップ。複数箇所に置けます。</div>
    <div class="chip-tray"><div class="chip-tray-label"><small>YOUR CHIPS</small><strong>選択中 ${fmt(s.rouletteChip)}</strong></div><div class="chip-options" role="group" aria-label="チップの金額">${CHIP_VALUES.map((n,i)=>`<button type="button" data-chip="${n}" ${busy?'disabled':''} class="casino-chip chip-${i} ${s.rouletteChip===n?'selected':''}" aria-pressed="${s.rouletteChip===n}" aria-label="${fmt(n)}コインのチップ"><span>${short(n)}</span></button>`).join('')}</div></div>
    <div class="roulette-controls"><div class="bet-total"><small>TOTAL BET</small><strong>${fmt(total)} <span>COINS</span></strong></div><div class="bet-edit"><button data-act="undo-chip" ${total&&!busy?'':'disabled'}>1枚戻す</button><button data-act="clear-chips" ${total&&!busy?'':'disabled'}>全て戻す</button><button data-act="repeat-chips" ${busy||total||!s.roulettePrevious?.length?'disabled':''}>前回と同じ</button></div><button class="primary spin-button" data-act="spin" ${total&&!busy?'':'disabled'}>${busy?'回転中…':'ルーレットを回す'} <span>${busy?'◌':'↗'}</span></button></div><div class="reserved-note">配置した分は残高から確保済み。回す前なら戻せます。</div></div></div>
    <div class="roulette-result ${busy?'awaiting-result':''}" role="status" aria-live="polite">${busy?'<span class="result-star">✦</span><div><strong>ボールの行方を、見届けよう。</strong><span>ベットを締め切りました。止まった数字で配当が決まります。</span></div>':round?`<div class="round-number ${round.n===0?'zero':red.has(round.n)?'number-red':'number-black'}">${round.n}</div><div><small>LAST ROUND</small><strong>払戻し ${fmt(round.returned)} <span>COINS</span></strong><span>ベット ${fmt(round.total)} · <b class="${round.delta>=0?'positive':'negative'}">${round.delta>=0?'+':''}${fmt(round.delta)}</b></span></div><div class="winning-bets">${round.details.filter(b=>b.returned).map(b=>`${SPOTS[b.spot].label}：${fmt(b.returned)}`).join(' / ')||'今回は的中なし。次も確率は変わりません。'}</div>`:'<span class="result-star">✦</span><div><strong>マットが、あなたの作戦盤。</strong><span>好きな金額のチップを、好きなマスへ。</span></div>'}</div>`;
}

// Pointer Events give mouse, pen and touch the same drag interaction.
// No wallet mutation occurs until a valid drop; cancel/outside drops are free.
export function attachChipDrag(s,render,notify) {
  let drag=null,ghost=null,hover=null;
  function cleanup(){ghost?.remove();hover?.classList.remove('drop-target');ghost=null;hover=null;drag=null;}
  document.addEventListener('pointerdown',e=>{
    const chip=e.target.closest('[data-chip]');
    if(!chip||chip.disabled||s.rouletteSpin||s.game!=='roulette'||e.button!==0||e.isPrimary===false||drag)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,amount:Number(chip.dataset.chip),el:chip,moved:false};
    chip.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
    drag.moved=true;e.preventDefault();
    if(!ghost){ghost=document.createElement('div');ghost.className=`casino-chip drag-ghost chip-${CHIP_VALUES.indexOf(drag.amount)}`;ghost.innerHTML=`<span>${short(drag.amount)}</span>`;document.body.append(ghost);}
    ghost.style.left=`${e.clientX}px`;ghost.style.top=`${e.clientY}px`;
    hover?.classList.remove('drop-target');hover=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-spot]');hover?.classList.add('drop-target');
  },{passive:false});
  document.addEventListener('pointerup',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const {moved,amount}=drag;
    const target=moved?document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-spot]'):null;
    cleanup();
    if(moved){
      // Suppress only the compatibility click generated by this pointerup.
      const swallow=e=>{e.preventDefault();e.stopImmediatePropagation();};
      document.addEventListener('click',swallow,{capture:true,once:true});
      setTimeout(()=>document.removeEventListener('click',swallow,true),0);
      if(target){try{placeChip(s,target.dataset.spot,amount);s.rouletteChip=amount;render();}catch(err){notify(err.message);}}
    }
  });
  document.addEventListener('pointercancel',cleanup);
  document.addEventListener('lostpointercapture',()=>{if(drag)cleanup();});
}
