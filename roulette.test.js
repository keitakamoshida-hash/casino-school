import test from 'node:test';
import assert from 'node:assert/strict';
import {initRoulette,SPOTS,WHEEL_ORDER,placeChip,undoChip,clearChips,repeatChips,totalBet,spotReturn,settleRoulette,rouletteTable,startRouletteSpin} from './roulette.js';
function wallet(balance=100000){const s={balance};initRoulette(s);return s;}
test('mat covers all 37 wheel pockets and all supported betting groups',()=>{
  assert.equal(SPOTS.n0.multiplier,36);assert.equal(new Set(WHEEL_ORDER).size,37);
  assert.equal(Object.keys(SPOTS).length,49);
  const html=rouletteTable(wallet());assert.equal((html.match(/data-spot=/g)||[]).length,49);
});
test('a spin changes the visual priority from mat to wheel',()=>{
  const s=wallet();placeChip(s,'n17',100);startRouletteSpin(s,17,1000);
  assert.match(rouletteTable(s),/roulette-arena spin-focus/);
});
test('placing chips reserves funds; undo and clear return exactly the reserved amount',()=>{
  const s=wallet();placeChip(s,'n0',100);placeChip(s,'red',1000);placeChip(s,'red',500);
  assert.equal(s.balance,98400);assert.equal(totalBet(s),1600);
  undoChip(s);assert.equal(s.balance,98900);assert.equal(totalBet(s),1100);
  clearChips(s);assert.equal(s.balance,100000);assert.equal(totalBet(s),0);
  clearChips(s);undoChip(s);assert.equal(s.balance,100000);
});
test('invalid, unaffordable and over-limit drops never mutate the wallet',()=>{
  const s=wallet(100);const before=JSON.stringify(s);
  assert.throws(()=>placeChip(s,'red',1000));assert.throws(()=>placeChip(s,'bogus',100));assert.throws(()=>placeChip(s,'red',-100));assert.equal(JSON.stringify(s),before);
  const high=wallet(2000000);for(let i=0;i<100;i++)placeChip(high,'n1',10000);
  assert.throws(()=>placeChip(high,'n1',100));assert.equal(totalBet(high),1000000);assert.equal(high.balance,1000000);
});
test('all supported bets have correct exhaustive payouts and zero handling',()=>{
  for(const [key,spot] of Object.entries(SPOTS)){
    const outcomes=Array.from({length:37},(_,n)=>spotReturn(n,key,100));
    const count=spot.type==='number'?1:['column','dozen'].includes(spot.type)?12:18;
    assert.equal(outcomes.filter(Boolean).length,count,key);assert.equal(outcomes.reduce((a,b)=>a+b,0),3600,key);
    if(spot.type!=='number')assert.equal(outcomes[0],0,key);
  }
  assert.equal(spotReturn(3,'column3',100),300);assert.equal(spotReturn(36,'column3',100),300);
  assert.equal(spotReturn(12,'dozen1',100),300);assert.equal(spotReturn(13,'dozen1',100),0);
});
test('multiple winning and losing bets settle once with inclusive payouts',()=>{
  const s=wallet();placeChip(s,'n3',100);placeChip(s,'red',1000);placeChip(s,'column3',500);placeChip(s,'dozen1',100);placeChip(s,'black',100);
  const r=settleRoulette(s,3);assert.equal(r.total,1800);assert.equal(r.returned,7400);assert.equal(r.delta,5600);assert.equal(s.balance,105600);assert.equal(totalBet(s),0);
  assert.throws(()=>settleRoulette(s,3));assert.equal(s.balance,105600);
  repeatChips(s);assert.equal(totalBet(s),1800);assert.equal(s.balance,103800);assert.throws(()=>repeatChips(s));
  clearChips(s);assert.equal(s.balance,105600);
});
test('zero straight-up win and even-money loss combine correctly',()=>{
  const s=wallet();placeChip(s,'n0',100);placeChip(s,'even',100);placeChip(s,'column1',100);
  const r=settleRoulette(s,0);assert.equal(r.returned,3600);assert.equal(s.balance,103300);
});
test('reload preserves reservations; repeat fails atomically when funds are insufficient',()=>{
  let s=wallet(500);placeChip(s,'red',500);s=JSON.parse(JSON.stringify(s));initRoulette(s);
  assert.equal(s.balance,0);assert.equal(totalBet(s),500);settleRoulette(s,0);
  assert.throws(()=>repeatChips(s));assert.equal(totalBet(s),0);assert.equal(s.balance,0);
});

test('spin holds result until stopped and resumes the same result after reload',async()=>{
 const {startRouletteSpin,finishRouletteSpin,SPIN_DURATION}=await import('./roulette.js');
 let s=wallet();placeChip(s,'n17',1000);startRouletteSpin(s,17,10000);
 assert.equal(s.lastNumber,undefined);assert.equal(s.balance,99000);
 assert.throws(()=>placeChip(s,'red',100));assert.throws(()=>clearChips(s));assert.throws(()=>undoChip(s));assert.throws(()=>repeatChips(s));assert.throws(()=>startRouletteSpin(s,1,10001));
 assert.equal(finishRouletteSpin(s,10000+SPIN_DURATION-1),null);
 s=JSON.parse(JSON.stringify(s));const result=finishRouletteSpin(s,10000+SPIN_DURATION);
 assert.equal(result.n,17);assert.equal(s.balance,135000);assert.equal(finishRouletteSpin(s,20000),null);
});
