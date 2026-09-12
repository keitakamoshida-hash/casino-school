import test from 'node:test';
import assert from 'node:assert/strict';
import {startExperience,finishExperience,revealSqueeze,experienceTable,squeezeOrder} from './experience.js';
const c=r=>({r,s:0});
test('baccarat can be squeezed card by card, including third cards, without early payout',()=>{
 const before={balance:10000,game:'baccarat',stake:1000,guide:true};
 const after={...before,balance:11000,bac:{p:[c(2),c(3),c(4)],b:[c(3),c(4)],ps:9,bs:7},result:{delta:1000}};
 let s={...before};startExperience(s,before,after,'deal',100);
 assert.equal(s.balance,9000);assert.equal(s.experience.ends,null);assert.equal(finishExperience(s,999999),false);
 assert.equal(revealSqueeze(s,'b0',100),false);assert.equal(revealSqueeze(s,'p0',100),true);assert.equal(revealSqueeze(s,'p0',100),false);
 for(const key of squeezeOrder(s.experience))revealSqueeze(s,key,1000);
 assert.equal(s.experience.ends,2400);assert.equal(s.balance,9000);
 s=JSON.parse(JSON.stringify(s));s.guide=false;
 assert.equal(finishExperience(s,2399),false);assert.equal(finishExperience(s,2400),true);assert.equal(s.balance,11000);assert.equal(s.guide,false);assert.equal(finishExperience(s,3000),false);
});
test('blackjack natural payout appears after initial deal, not before',()=>{
 const before={game:'blackjack',balance:10000,stake:1000,guide:true};
 const after={...before,balance:11500,active:null,lastHand:{kind:'blackjack',p:[c(14),c(13)],d:[c(10),c(9)],bet:1000},result:{delta:1500}};
 const s={...before};startExperience(s,before,after,'start',1000);assert.equal(s.balance,9000);assert.match(experienceTable(s,1100),/カードが、配られる/);
 assert.equal(finishExperience(s,3399),false);assert.equal(finishExperience(s,3400),true);assert.equal(s.balance,11500);
});
test('dealer draws and poker showdown delay final outcomes',()=>{
 const before={game:'blackjack',balance:9000,stake:1000,guide:true,active:{bet:1000}};
 const after={...before,balance:11000,active:null,lastHand:{kind:'blackjack',p:[c(10),c(9)],d:[c(2),c(3),c(4),c(10)],bet:1000}};
 const s={...before};startExperience(s,before,after,'stand',0);assert.equal(s.balance,9000);assert.match(experienceTable(s,500),/ディーラーのターン/);assert.equal(s.experience.dealerTurn,true);finishExperience(s,10000);assert.equal(s.balance,11000);
});

test('blackjack only animates newly dealt cards and resumes animation age on redraw',()=>{
 const before={game:'blackjack',balance:10000,stake:1000,guide:true};
 const after={...before,balance:9000,active:{kind:'blackjack',p:[c(10),c(8)],d:[c(9),c(7)],bet:1000}};
 const s={...before};startExperience(s,before,after,'start',1000);
 const at=ms=>experienceTable(s,1000+ms);
 assert.equal((at(0).match(/card-arrive/g)||[]).length,1);
 assert.equal((at(420).match(/card-arrive/g)||[]).length,1);
 assert.equal((at(600).match(/card-arrive/g)||[]).length,1);
 assert.match(at(600),/animation-delay:-180ms/);
 assert.equal((at(840).match(/card-arrive/g)||[]).length,1);
 assert.equal((at(1260).match(/card-arrive/g)||[]).length,1);
 assert.equal((at(1750).match(/card-arrive/g)||[]).length,0);
 assert.equal((at(1750).match(/blackjack-row/g)||[]).length,2);
});

test('standing does not redeal player cards and dealer draw animates only its new card',()=>{
 const before={game:'blackjack',balance:9000,stake:1000,guide:true,active:{bet:1000}};
 const after={...before,balance:9000,active:null,lastHand:{kind:'blackjack',p:[c(10),c(8)],d:[c(10),c(6),c(3)],bet:1000}};
 const s={...before};startExperience(s,before,after,'stand',0);
 assert.equal((experienceTable(s,600).match(/card-arrive/g)||[]).length,0);
 assert.equal((experienceTable(s,650).match(/card-reveal/g)||[]).length,1);
 assert.equal((experienceTable(s,1100).match(/card-reveal/g)||[]).length,0);
 assert.equal((experienceTable(s,1950).match(/card-arrive/g)||[]).length,1);
 assert.equal((experienceTable(s,2400).match(/card-arrive/g)||[]).length,0);
});

test('poker deals into stable slots and animates only the newly arriving card',()=>{
 const before={game:'poker',balance:10000,stake:1000,guide:true,active:{board:[]}};
 const after={...before,active:{kind:'poker',p:[c(14),c(13)],cpu:[c(10),c(9)],board:[c(2),c(3),c(4)],pot:2000},balance:9000};
 const s={...before};startExperience(s,before,after,'check',1000);
 const at=ms=>experienceTable(s,1000+ms);
 assert.equal((at(350).match(/poker-row/g)||[]).length,3);
 assert.equal((at(350).match(/card-arrive/g)||[]).length,1);
 assert.equal((at(700).match(/card-arrive/g)||[]).length,1);
 assert.equal((at(1050).match(/card-arrive/g)||[]).length,1);
});
