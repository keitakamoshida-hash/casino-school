const money=n=>n.toLocaleString('ja-JP');
const suit=['♠','♥','♦','♣'];
const face=c=>({11:'J',12:'Q',13:'K',14:'A'})[c.r]||c.r;
const clone=v=>JSON.parse(JSON.stringify(v));
const score=cards=>cards.reduce((sum,c)=>sum+(c.r===14?1:c.r>=10?0:c.r),0)%10;
export function createExperience(before,after,action,now=Date.now()) {
  const game=before.game;
  if(game==='roulette'||!['start','hit','stand','double','deal','check','bet','call','fold'].includes(action))return null;
  const hand=after.active||after.lastHand;
  if(game==='baccarat'&&action==='deal')return {kind:'baccarat',started:now,revealed:[],after:clone(after),hand:clone(after.bac),displayBalance:before.balance-before.stake,ends:null};
  if(game==='blackjack'&&hand?.kind==='blackjack'){
    const terminal=!after.active,deal=action==='start';
    const dealerTurn=terminal&&(action==='stand'||action==='double'||(action==='hit'&&hand.p.reduce((a,c)=>a+(c.r===14?1:Math.min(c.r,10)),0)<=21));
    const duration=deal?2400:dealerTurn?1200+Math.max(2,hand.d.length)*850:1100;
    return {kind:'blackjack',started:now,ends:now+duration,action,terminal,dealerTurn,hand:clone(hand),after:clone(after),displayBalance:before.balance-(deal?before.stake:action==='double'?before.active.bet:0)};
  }
  if(game==='poker'&&hand?.kind==='poker'){
    const terminal=!after.active,showdown=terminal&&!!hand.showdown;
    const duration=action==='start'?1700:showdown?2600:terminal?1400:1500;
    return {kind:'poker',started:now,ends:now+duration,action,terminal,showdown,hand:clone(hand),previousBoard:before.active?.board.length||0,after:clone(after),displayBalance:before.balance-(action==='start'?before.stake:['bet','call'].includes(action)?before.active.unit:0)};
  }
  return null;
}
export function startExperience(s,before,after,action,now=Date.now()) {
  const exp=createExperience(before,after,action,now);if(!exp)return false;
  Object.assign(s,before);s.balance=exp.displayBalance;s.experience=exp;return true;
}
export function finishExperience(s,now=Date.now()) {
  const e=s.experience;if(!e||e.ends===null||now<e.ends)return false;
  const guide=s.guide;Object.assign(s,e.after);s.guide=guide;s.experience=null;return true;
}
export function squeezeOrder(e){const order=['p0','b0','p1','b1'];if(e.hand.p.length===3)order.push('p2');if(e.hand.b.length===3)order.push('b2');return order;}
export function revealSqueeze(s,key,now=Date.now()) {
  const e=s.experience;if(e?.kind!=='baccarat'||e.ends!==null)return false;
  const next=squeezeOrder(e).find(k=>!e.revealed.includes(k));if(key!==next)return false;
  e.revealed.push(key);
  if(e.revealed.length===squeezeOrder(e).length)e.ends=now+1400;
  return true;
}
function card(c,hidden=false,extra='') {return `<div class="experience-card ${hidden?'face-down':c.s===1||c.s===2?'face-red':''} ${extra}" ${hidden?'aria-label="裏向きのカード"':`aria-label="${suit[c.s]}${face(c)}"`}>${hidden?'<span class="card-emblem">♠</span>':`<span class="card-corner">${face(c)}<i>${suit[c.s]}</i></span><span class="card-suit">${suit[c.s]}</span><span class="card-corner bottom">${face(c)}<i>${suit[c.s]}</i></span>`}</div>`;}
export function renderCards(cs,options={}){return `<div class="experience-cards">${cs.map((c,i)=>card(c,options.hidden?.(i)||false,options.animate?.(i)?'card-arrive':'')).join('')}</div>`;}
function squeezeCard(c,key,e,next){const revealed=e.revealed.includes(key);return `<button class="squeeze-card ${key===next?'ready-to-squeeze':''} ${revealed?'revealed':''}" data-squeeze="${key}" ${key!==next?'disabled':''} aria-label="${key.startsWith('p')?'Player':'Banker'}の${Number(key[1])+1}枚目${revealed?'、公開済み':'、上へスライドして絞る'}"><span class="squeeze-face" ${revealed?'':'aria-hidden="true"'}>${card(c)}</span>${revealed?'':`<span class="card-veil"><span class="card-emblem">♠</span><span class="squeeze-arrow">↑ ${key===next?'絞る':'WAIT'}</span></span><span class="card-fold"></span>`}</button>`;}
export function experienceTable(s,now=Date.now()) {
 const e=s.experience,t=now-e.started,h=e.hand;
 if(e.kind==='baccarat'){
  const next=squeezeOrder(e).find(k=>!e.revealed.includes(k));
  return `<div class="experience-heading"><span class="eyebrow">BACCARAT · SQUEEZE TABLE</span><h2>その一枚を、あなたの指で。</h2><p>${next?'光っているカードを上へゆっくりスライド。途中で止めて、少しずつ絞れます。':'全てのカードが開きました。勝負の行方は…'}</p></div><div class="baccarat-sides">${['p','b'].map(side=>`<div class="baccarat-side"><div class="caption">${side==='p'?'PLAYER':'BANKER'} <span class="hand-score">${h[side].every((_,i)=>e.revealed.includes(side+i))?score(h[side]):'?'}</span></div><div class="experience-cards">${(e.revealed.length>=4?h[side]:h[side].slice(0,2)).map((c,i)=>squeezeCard(c,side+i,e,next)).join('')}</div></div>`).join('')}</div><div class="experience-status"><span class="status-light"></span>${next?`${next.startsWith('p')?'PLAYER':'BANKER'} · ${Number(next[1])+1}枚目を絞る`:'勝負を判定しています…'}</div><div class="actions">${next?'<button data-act="reveal-card">1枚めくる</button><button data-act="reveal-all" class="quiet-button">まとめて開く</button>':''}</div><p class="experience-stake">BET ${money(e.after.stake)} COINS · ${e.after.bacTarget||'Player'}</p>`;
 }
 if(e.kind==='blackjack'){
  const initial=e.action==='start',dealCount=Math.min(4,1+Math.floor(t/420));
  const dealerCount=e.dealerTurn?Math.min(h.d.length,2+Math.max(0,Math.floor((t-1100)/850))):2;
  const hideHole=initial?t<1750||!e.terminal:!e.dealerTurn||t<650;
  let p=h.p,d=h.d.slice(0,dealerCount);
  if(initial){p=h.p.slice(0,dealCount>=3?2:1);d=h.d.slice(0,dealCount>=4?2:dealCount>=2?1:0);}
  if(e.action==='double'&&t<600)p=h.p.slice(0,2);
  return `<div class="experience-heading"><span class="eyebrow">BLACKJACK · LIVE TABLE</span><h2>${initial?'カードが、配られる。':e.dealerTurn?'ディーラーのターン。':'次の一枚は…'}</h2></div><div class="caption">DEALER</div>${renderCards(d,{hidden:i=>i===1&&hideHole,animate:i=>i===d.length-1})}<div class="table-divider"><span>BLACKJACK PAYS 3 TO 2</span></div><div class="caption">YOUR HAND</div>${renderCards(p,{animate:i=>i===p.length-1})}<div class="experience-status"><span class="status-light"></span>${initial?'一枚ずつ、手札を確かめよう。':e.dealerTurn?'伏せ札を開き、17以上になるまで引きます。':'カードを確認しています…'}</div>`;
 }
 const reveal=e.showdown&&t>900;
 const board=h.board.slice(0,e.previousBoard+Math.max(0,Math.floor(t/350)));
 return `<div class="experience-heading"><span class="eyebrow">TEXAS HOLD’EM · LIVE TABLE</span><h2>${e.showdown?'ショーダウン。':e.action==='start'?'勝負の、はじまり。':e.terminal?'勝負が、動いた。':'次のカードを待つ。'}</h2></div><div class="caption">CPU ${e.showdown?'· SHOWDOWN':''}</div>${renderCards(h.cpu,{hidden:()=>!reveal,animate:()=>reveal})}<div class="table-divider"><span>POT ${money(h.pot)} COINS</span></div>${board.length?renderCards(board,{animate:i=>i>=e.previousBoard}):'<div class="community-wait">FLOP · TURN · RIVER</div>'}<div class="caption">YOUR HAND</div>${renderCards(h.p,{hidden:i=>e.action==='start'&&t<i*500,animate:()=>e.action==='start'})}<div class="experience-status"><span class="status-light"></span>${e.showdown?'互いの手札を公開します。':e.terminal?'ベットを精算しています…':'CPUが判断しています…'}</div>`;
}
export function attachSqueeze(s,render,save) {
 let drag=null;
 const clear=()=>{if(drag){drag.el.style.setProperty('--peel','0%');drag=null;}};
 document.addEventListener('pointerdown',ev=>{
  const el=ev.target.closest('[data-squeeze]');if(!el||el.disabled||ev.button!==0||ev.isPrimary===false)return;
  drag={id:ev.pointerId,y:ev.clientY,el,progress:0};el.setPointerCapture(ev.pointerId);
 });
 document.addEventListener('pointermove',ev=>{
  if(!drag||drag.id!==ev.pointerId)return;ev.preventDefault();
  drag.progress=Math.min(1,Math.max(0,(drag.y-ev.clientY)/100));drag.el.style.setProperty('--peel',`${drag.progress*100}%`);
 },{passive:false});
 document.addEventListener('pointerup',ev=>{
  if(!drag||drag.id!==ev.pointerId)return;const {progress,el}=drag;clear();
  if(progress>=.8){revealSqueeze(s,el.dataset.squeeze);save();render();}
 });
 document.addEventListener('pointercancel',clear);
 document.addEventListener('lostpointercapture',clear);
}
