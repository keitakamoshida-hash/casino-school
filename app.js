import {deck,bj,baccarat,rank,names,equity,randomInt,red,tokyoDate} from './engine.js';
import {initRoulette,rouletteTable,placeChip,undoChip,clearChips,repeatChips,totalBet,startRouletteSpin,finishRouletteSpin,attachChipDrag} from './roulette.js';
import {startExperience,finishExperience,experienceTable,attachSqueeze,revealSqueeze,squeezeOrder,renderCards} from './experience.js';
const key='casino-school-v1',money=n=>Math.round(n).toLocaleString('ja-JP');
let s;try{s=JSON.parse(localStorage.getItem(key));}catch{}s=s&&s.version===1?s:{version:1,balance:0,claimed:'',guide:true,difficulty:'normal',game:'poker',stake:1000,history:[],active:null,result:null};
initRoulette(s);
let spinTimer,experienceTimer;
let storageError=false;function save(){try{localStorage.setItem(key,JSON.stringify(s));}catch{storageError=true;}}
const labels={poker:'ポーカー',blackjack:'ブラックジャック',roulette:'ルーレット',baccarat:'バカラ'};
const guides={poker:`<p>テキサスホールデムを、CPUとの1対1で学びます。</p><ol><li>自分の2枚と共通カード5枚から、最強の5枚を作ります。</li><li>開始時に双方が参加額を出します。このゲームは学習用の固定額ベット。各段階で追加ベットは1回です。</li><li>チェック＝追加せず進む。ベット＝追加する。コール＝相手と同額を出す。フォールド＝降りて、それまでの賭けを失う。</li><li>フロップ3枚 → ターン1枚 → リバー1枚。最後に役を比べます。同点は山分け。</li></ol><p>強い順：ストレートフラッシュ → フォーカード → フルハウス → フラッシュ → ストレート → スリーカード → ツーペア → ワンペア → ハイカード。</p><p>CPUは各ハンドで必要額を補充します。オールイン・サイドポット・ブラインドは未採用です。</p>`,blackjack:`<p>21を超えず、ディーラーより21に近づけます。絵札は10、Aは1または11。</p><ol><li>ヒット：1枚引く。スタンド：今の点数で勝負。</li><li>ダブル：最初の2枚で賭けを倍にし、1枚だけ引いて勝負。</li><li>ディーラーは17以上で止まります（ソフト17もスタンド）。</li></ol><p>6デッキを毎回シャッフル。通常勝利は1倍の利益、最初の2枚の21は利益1.5倍（3:2）。例えば1,000を賭けると、利益1,500＋元の1,000＝2,500が戻ります。相手も最初の2枚で21なら引き分けで元の賭けだけ返却。スプリット・保険・サレンダーはこの版では未対応です。</p><p>目安：17以上は止まる。ハード12〜16は相手が弱い札なら止まり、強い札なら引く判断が中心。以下のヒントは簡易版で、完全な基本戦略表ではありません。</p>`,roulette:`<p>チップを選んでマットへドラッグ。クリック・タップでも置けます。同じマスに重ねたり、複数のマスに分けて賭けられます。</p><ol><li>数字1点（0を含む）：36倍の払戻し。</li><li>列「2:1」・12数字のグループ：3倍の払戻し。</li><li>赤黒・奇偶・大小：2倍の払戻し。0は外れです。</li></ol><p>払戻しは元の賭け金込み。マットの枠線をまたぐスプリット・コーナーには未対応です。</p><p>「1枚戻す」は最後の配置を取り消します。「全て戻す」は全額返却。「前回と同じ」は前回の配置を再現します。</p><p>横画面でホイールとマットを同時に見られます。出目に偏りをつける調整はありません。</p>`,baccarat:`<p>PlayerとBanker、どちらの点数が9に近いかを予想します。あなたがPlayer側になるわけではありません。</p><ol><li>Aは1、10と絵札は0。それ以外は数字どおり。合計の一の位が得点です。</li><li>追加カードは固定ルールで自動配札します。</li><li>Player勝利は2倍、Banker勝利は手数料5%を引いて1.95倍、Tieは9倍の払戻し。</li></ol><p>引き分けならPlayer／Bankerへの賭けは返金。8デッキを毎回シャッフルします。</p>`};
function cards(cs,hidden=false){return renderCards(cs,{hidden:i=>hidden&&i>0});}
const button=(act,text,disabled=false,primary=false)=>`<button data-act="${act}" ${disabled?'disabled':''} class="${primary?'primary':''}">${text}</button>`;
function record(name,start,message){if(s.active)s.lastHand=JSON.parse(JSON.stringify(s.active));const delta=s.balance-start;s.history.unshift({name,delta});s.history=s.history.slice(0,12);s.result={message,delta};s.active=null;}
function pay(n){if(!Number.isSafeInteger(n)||n<1||s.balance<n)throw Error('コインが足りません。賭け額を下げるか、デイリーコインを受け取ってください。');s.balance-=n;}
function hint(){const a=s.active;if(!a)return 'まずは少額で始めて、操作とルールを確かめよう。';if(a.kind==='blackjack'){const n=bj(a.p),up=a.d[0].r===14?11:Math.min(a.d[0].r,10);if(a.p.some(c=>c.r===14)&&a.p.reduce((v,c)=>v+(c.r===14?1:Math.min(c.r,10)),0)+10===n)return 'Aを11として使えるソフトハンドです。Aを1にもできるため、引く判断の幅が広がります。';return n>=17?'17以上。基本はスタンドを検討。':n<=11?'11以下なので、次の1枚ではバストしません。':up>=7?'相手の表札が強め。引く判断を検討します。':'相手がバストする可能性も考え、スタンドを検討します。';}if(a.kind==='poker')return a.pending?'CPUのベットに対して、コールかフォールドを選びます。勝てる見込みと追加する額を比較しよう。':'チェックなら追加せず進めます。ベットするとCPUにコールかフォールドを迫れます。';return '';}
function table(){if(s.experience)return experienceTable(s);const a=s.active,r=s.result;
if(!a&&r&&s.lastHand?.kind===s.game&&['poker','blackjack'].includes(s.game)){const h=s.lastHand;return `<div class="caption">${s.game==='poker'?'CPU · SHOWDOWN':'DEALER'}</div>${s.game==='poker'?renderCards(h.cpu,{hidden:()=>!h.showdown}):cards(h.d)}${s.game==='poker'&&h.board.length?cards(h.board):''}<div class="caption">YOUR HAND</div>${cards(h.p)}<div class="message" role="status">${r.message}<br><strong class="${r.delta>=0?'positive':'negative'}">${r.delta>=0?'+':''}${money(r.delta)} COINS</strong></div><div class="actions">${button('start','次のハンドへ',s.balance<s.stake,true)}</div>`;}
let html='';if(s.game==='poker'){if(a){html=`<div class="caption">CPU · ${s.difficulty==='easy'?'ビギナー':s.difficulty==='hard'?'上級':'標準'}</div>${renderCards(a.cpu,{hidden:()=>true})}<div class="pill">POT ${money(a.pot)} COINS · ${['プリフロップ','フロップ','ターン','リバー'][a.street]}</div>${a.board.length?cards(a.board):'<div class="cards"><span class="tiny">共通カードはこれから配られます</span></div>'}<div class="caption">YOUR HAND ${a.board.length?'· '+names[rank([...a.p,...a.board]).category]:''}</div>${cards(a.p)}<div class="actions">${a.pending?button('call',`コール ${money(a.unit)}`,s.balance<a.unit,true):button('check','チェック',false,true)}${!a.pending?button('bet',`ベット ${money(a.unit)}`,s.balance<a.unit):''}${button('fold','フォールド')}</div>`;}else html=`<div class="caption">TEXAS HOLD’EM · HEADS UP</div><h2>判断で、勝負する。</h2>${cards([{r:14,s:0},{r:13,s:0}])}<p>自分の2枚と共通カードで、最強の5枚を。</p>${button('start','テーブルに参加',s.balance<s.stake,true)}`;}
if(s.game==='blackjack'){if(a)html=`<div class="caption">DEALER · ${bj([a.d[0]])} + ?</div>${cards(a.d,true)}<div class="caption">YOUR HAND · ${bj(a.p)}</div>${cards(a.p)}<div class="pill">BET ${money(a.bet)}</div><div class="actions">${button('hit','ヒット',false,true)}${button('stand','スタンド')}${button('double','ダブル',a.p.length!==2||s.balance<a.bet)}</div>`;else html=`<div class="caption">BLACKJACK · DEALER STANDS ON 17</div><h2>21へ、あと一歩。</h2>${cards([{r:14,s:0},{r:13,s:1}])}<p>引くか、止まるか。判断を学ぼう。</p>${button('start','カードを配る',s.balance<s.stake,true)}`;}
if(s.game==='roulette')return rouletteTable(s);
if(s.game==='baccarat')html=`<div class="caption">BACCARAT · PLAYER / BANKER / TIE</div><h2>9に近いのは、どっち？</h2>${s.bac?`<div class="caption">PLAYER · ${s.bac.ps}</div>${cards(s.bac.p)}<div class="caption">BANKER · ${s.bac.bs}</div>${cards(s.bac.b)}`:'<p>賭け先を選んで、カードの行方を見届けよう。</p>'}<select id="bacTarget" aria-label="バカラの賭け先">${['Player','Banker','Tie'].map(v=>`<option ${s.bacTarget===v?'selected':''}>${v}</option>`).join('')}</select><div class="actions">${button('deal','勝負する',s.balance<s.stake,true)}</div>`;
return html+(r?`<div class="message" role="status">${r.message}<br><strong class="${r.delta>=0?'positive':'negative'}">${r.delta>=0?'+':''}${money(r.delta)} COINS</strong></div>`:'');}
function render(){save();document.querySelector('#app').innerHTML=`<header><div class="brand">♠ CASINO SCHOOL <div class="tiny">PLAY. LEARN. LEVEL UP.</div></div><div class="balance"><div><div class="tiny">YOUR WALLET</div><strong>${money(s.balance)}</strong> <small>COINS</small></div>${button('daily',s.claimed===tokyoDate()?'本日受取済み':'本日の10万を受け取る',s.claimed===tokyoDate()||!!s.experience,true)}</div></header><main class="${s.game==='roulette'?'roulette-page':'card-game-page'}"><div class="intro"><div class="eyebrow">YOUR DAILY PLAYGROUND</div><h1>遊んで、わかる。<br>判断が、うまくなる。</h1><p>毎日10万円分のコインで、カジノの世界を学ぼう。</p></div><nav aria-label="ゲーム選択">${Object.entries(labels).map(([k,v])=>`<button data-game="${k}" class="${s.game===k?'active':''}" ${s.active||s.rouletteSpin||s.experience?'disabled':''}>${v}</button>`).join('')}</nav><div class="toolbar"><label><input id="guide" type="checkbox" ${s.guide?'checked':''}> 学習ガイド</label>${s.game!=='roulette'?`<label>賭け額 <input id="stake" aria-label="賭け額" type="number" min="100" max="1000000" step="100" value="${s.stake}" ${s.active||s.experience?'disabled':''}></label>`:''}${s.game==='poker'?`<label>CPU <select id="difficulty" ${s.active||s.experience?'disabled':''}><option value="easy" ${s.difficulty==='easy'?'selected':''}>ビギナー</option><option value="normal" ${s.difficulty==='normal'?'selected':''}>標準</option><option value="hard" ${s.difficulty==='hard'?'selected':''}>上級</option></select></label>`:''}</div><div class="layout ${s.guide?'':'solo'}"><section class="table" aria-label="ゲームテーブル">${table()}</section><aside class="guide" ${s.guide?'':'hidden'}><h3>HOW TO PLAY</h3>${guides[s.game]}<h3>今のヒント</h3><p>${hint()}</p></aside></div><p id="error" class="error" role="alert">${storageError?'ブラウザの保存領域を利用できません。この画面を閉じると進行が失われます。':''}</p><section class="history"><div><strong>RECENT PLAY</strong><span>直近12ゲーム · 純増減</span></div>${s.history.map(h=>`<div><span>${h.name}</span><span class="${h.delta>=0?'positive':'negative'}">${h.delta>=0?'+':''}${money(h.delta)}</span></div>`).join('')||'<p>最初のゲームを始めよう。</p>'}</section></main><footer>架空のコイン専用 · 購入・換金なし · デイリー更新は日本時間0時<br>このブラウザに自動保存。CPUの難易度で配札確率は変わりません。</footer>`;scheduleSpin();scheduleExperience();}
function scheduleExperience(){
  clearTimeout(experienceTimer);
  const e=s.experience;if(!e||e.ends===null)return;
  const elapsed=Date.now()-e.started;
  const frames=e.kind==='blackjack'?(e.action==='start'?[420,840,1260,1750]:e.dealerTurn?[600,650,1100,...Array.from({length:e.hand.d.length},(_,i)=>1950+i*850)]:[]):e.kind==='poker'?[350,500,700,900,1050]:[];
  const next=frames.find(ms=>ms>elapsed+5);
  const wake=Math.min(e.ends,next===undefined?e.ends:e.started+next);
  experienceTimer=setTimeout(()=>{finishExperience(s);render();},Math.max(1,wake-Date.now()));
}
function scheduleSpin(){
  clearTimeout(spinTimer);
  if(!s.rouletteSpin)return;
  spinTimer=setTimeout(()=>{
    const start=s.balance+totalBet(s);
    const round=finishRouletteSpin(s);
    if(round){record('ルーレット',start,`${round.n}（${round.n===0?'緑':red.has(round.n)?'赤':'黒'}） · 払戻し ${money(round.returned)} COINS`);render();}
    else scheduleSpin();
  },Math.max(0,s.rouletteSpin.ends-Date.now()));
}
function finishBJ(){const a=s.active;while(bj(a.d)<17)a.d.push(a.deck.pop());const p=bj(a.p),d=bj(a.d),win=p<=21&&(d>21||p>d),tie=p<=21&&p===d;s.balance+=win?a.bet*2:tie?a.bet:0;record('ブラックジャック',a.start,`あなた ${p} ／ ディーラー ${d}（${a.d.map(c=>({11:'J',12:'Q',13:'K',14:'A'})[c.r]||c.r).join('・')}）\n${win?'あなたの勝ち！':tie?'引き分け。賭け額を返却。':'ディーラーの勝ち。'}`);}
function strength(a){return s.difficulty==='easy'?randomInt(100)/100:equity(a.cpu,a.board,s.difficulty==='hard'?140:40);}
function advance(){const a=s.active;a.pending=false;if(a.street===3){a.showdown=true;const p=rank([...a.p,...a.board]),c=rank([...a.cpu,...a.board]);s.balance+=p.score>c.score?a.pot:p.score===c.score?a.pot/2:0;record('ポーカー',a.start,`あなた：${names[p.category]} ／ CPU：${names[c.category]}\nCPUの手札：${a.cpu.map(c=>`${['♠','♥','♦','♣'][c.s]}${({11:'J',12:'Q',13:'K',14:'A'})[c.r]||c.r}`).join(' ')}\n共通：${a.board.map(c=>`${['♠','♥','♦','♣'][c.s]}${({11:'J',12:'Q',13:'K',14:'A'})[c.r]||c.r}`).join(' ')}\n${p.score>c.score?'あなたの勝ち！':p.score===c.score?'引き分け。ポットを山分け。':'CPUの勝ち。'}`);return;}a.street++;a.deck.pop();for(let i=0;i<(a.street===1?3:1);i++)a.board.push(a.deck.pop());}
function action(act){const a=s.active;if(act==='daily'){if(s.claimed!==tokyoDate()){s.balance+=100000;s.claimed=tokyoDate();if(a)a.start+=100000;}return;}if(act==='start'){if(a)return;const start=s.balance;pay(s.stake);s.result=null;const d=deck(s.game==='blackjack'?6:1);if(s.game==='poker'){s.active={kind:'poker',start,deck:d,p:[d.pop(),d.pop()],cpu:[d.pop(),d.pop()],board:[],street:0,pot:s.stake*2,unit:s.stake,pending:false};}else{s.active={kind:'blackjack',start,deck:d,p:[d.pop(),d.pop()],d:[d.pop(),d.pop()],bet:s.stake};const b=s.active;if(bj(b.p)===21||bj(b.d)===21){s.balance+=bj(b.p)===21?(bj(b.d)===21?b.bet:b.bet*2.5):0;record('ブラックジャック',start,`あなた ${bj(b.p)} ／ ディーラー ${bj(b.d)}\n${bj(b.p)===21&&bj(b.d)!==21?`ブラックジャック！ 利益は賭け額の1.5倍（3:2）。利益 ${money(b.bet*1.5)} ＋ 賭け額 ${money(b.bet)} ＝ 払戻し ${money(b.bet*2.5)} COINS。`:bj(b.p)===bj(b.d)?'引き分け。':'ディーラーのブラックジャック。'}`);}}return;}
if(a?.kind==='blackjack'){if(act==='hit'){a.p.push(a.deck.pop());if(bj(a.p)>21)record('ブラックジャック',a.start,`${bj(a.p)}。バストしました。`);else if(bj(a.p)===21)finishBJ();}if(act==='stand')finishBJ();if(act==='double'&&a.p.length===2){pay(a.bet);a.bet*=2;a.p.push(a.deck.pop());finishBJ();}return;}
if(a?.kind==='poker'){if(act==='fold')record('ポーカー',a.start,'フォールド。CPUがポットを獲得。');else if(act==='call'&&a.pending){pay(a.unit);a.pot+=a.unit;advance();}else if(act==='bet'&&!a.pending){pay(a.unit);a.pot+=a.unit;const power=strength(a),fold=power<(s.difficulty==='easy'?.18:.30);if(fold){s.balance+=a.pot;record('ポーカー',a.start,'CPUがフォールド。あなたがポットを獲得！');}else{a.pot+=a.unit;advance();}}else if(act==='check'&&!a.pending){const power=strength(a);if(s.balance>=a.unit&&(power>.62||randomInt(100)<(s.difficulty==='hard'?15:5))){a.pending=true;a.pot+=a.unit;}else advance();}return;}
if(act==='undo-chip'){undoChip(s);return;}
if(act==='clear-chips'){clearChips(s);return;}
if(act==='repeat-chips'){repeatChips(s);return;}
if(act==='spin'){startRouletteSpin(s,randomInt(37));return;}
if(act==='deal'){const start=s.balance;pay(s.stake);const b=baccarat(deck(8));s.bac=b;const winner=b.ps>b.bs?'Player':b.bs>b.ps?'Banker':'Tie',target=s.bacTarget||'Player';const ret=winner===target?s.stake*(winner==='Tie'?9:winner==='Banker'?1.95:2):winner==='Tie'?s.stake:0;s.balance+=ret;record('バカラ',start,`${winner} ${winner==='Tie'?'引き分け':'の勝ち'} · 払戻し ${money(ret)} COINS`);}}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 try{
  if(s.experience){
   if(s.experience.kind==='baccarat'){
    if(b.dataset.act==='reveal-card')revealSqueeze(s,squeezeOrder(s.experience).find(k=>!s.experience.revealed.includes(k)));
    if(b.dataset.act==='reveal-all')for(const key of squeezeOrder(s.experience))revealSqueeze(s,key);
   }
   render();return;
  }
  if(b.dataset.game&&!s.active&&!s.rouletteSpin){s.game=b.dataset.game;s.result=null;}
  else if(b.dataset.chip){s.rouletteChip=Number(b.dataset.chip);}
  else if(b.dataset.spot){placeChip(s,b.dataset.spot);}
  else if(b.dataset.act){const before=JSON.parse(JSON.stringify(s));action(b.dataset.act);const after=JSON.parse(JSON.stringify(s));startExperience(s,before,after,b.dataset.act);}
  render();
 }catch(err){document.querySelector('#error').textContent=err.message;}
});
document.addEventListener('change',e=>{const {id,value,checked}=e.target;if(id==='guide')s.guide=checked;else if(id==='stake'){const n=Number(value);if(!Number.isInteger(n)||n<100||n>1000000||n%100){e.target.value=s.stake;document.querySelector('#error').textContent='賭け額は100〜1,000,000の100刻みです。';return;}s.stake=n;}else if(id==='difficulty')s.difficulty=value;else if(id==='bacTarget')s.bacTarget=value;render();});
attachSqueeze(s,render,save);
attachChipDrag(s,render,message=>{document.querySelector('#error').textContent=message;});
render();
