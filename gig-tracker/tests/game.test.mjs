import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, transition, isValidGame, migrateGame, rollDie, allDice, legalFixerDice, needsTurnGig, canSteal, streetCred, DIE_TYPES } from '../dist/game.js';
const step = (g, action) => { const next=transition(g,action); assert.ok(isValidGame(next),'physical inventory remains valid'); return next; };
const roll = (g, sides=legalFixerDice(g.players[g.active])[0]?.sides, value=1) => step(g,{type:'roll-in',dieId:g.players[g.active].fixer.find(d=>d.sides===sides)?.id,value});
function seventh(first=0){let g=createGame(['V','Jackie'],first);for(let i=0;i<12;i++){g=roll(g);g=step(g,{type:'end-turn'});}return g;}
function setup(g, gigs0=[], gigs1=[]){return step(g,{type:'settings',inventory:allDice().map(d=>({id:d.id,zone:gigs0.includes(d.id)?'0-gigs':gigs1.includes(d.id)?'1-gigs':`${d.owner}-fixer`,value:Math.min(d.sides,3)}))});}
const seven=['0-4','0-6','0-8','0-10','0-12','0-20','1-4'];
const asLegacy=g=>{const old=structuredClone(g);old.version=1;delete old.needsDiceReview;delete old.removed;old.players.forEach(p=>{p.fixer=p.fixer.length;p.gigs=p.gigs.map(d=>d.value);});return old;};
function mainPhase(g){
  if(!needsTurnGig(g))return g;
  const die=legalFixerDice(g.players[g.active])[0];
  return step(roll(g,die.sides),{type:'return-fixer',player:g.active,dieId:die.id});
}

test('each player starts with exactly one D4 D6 D8 D10 D12 D20',()=>{
  const g=createGame();assert.ok(isValidGame(g));assert.equal(allDice().length,12);
  for(const p of g.players){assert.deepEqual(p.fixer.map(d=>d.sides),DIE_TYPES);assert.deepEqual(p.gigs,[]);}
});
test('any of the first five dice may be chosen first',()=>{
  for(const sides of DIE_TYPES.filter(n=>n!==20)){const g=roll(createGame(),sides,sides);assert.equal(g.players[0].gigs[0].sides,sides);assert.equal(g.players[0].gigs[0].value,sides);}
});
test('D20 is rejected while any other die remains in Fixer',()=>{
  const g=createGame();assert.equal(transition(g,{type:'roll-in',dieId:'0-20',value:20}),g);
  assert.deepEqual(legalFixerDice(g.players[0]).map(d=>d.sides),[4,6,8,10,12]);
});
test('arbitrary roll order is allowed and D20 unlocks only as the final die',()=>{
  let g=createGame();for(const sides of [12,4,10,8,6]){g=roll(g,sides,sides);g=step(g,{type:'end-turn'});g=step(g,{type:'end-turn'});}
  assert.deepEqual(g.players[0].fixer.map(d=>d.sides),[20]);assert.equal(legalFixerDice(g.players[0])[0].id,'0-20');
  g=roll(g,20,20);assert.equal(g.players[0].gigs.at(-1).value,20);assert.equal(g.players[0].fixer.length,0);
});
test('a Gig rolls in once per turn and previous snapshots remain unchanged',()=>{
  const old=createGame(),g=roll(old,8,8);assert.equal(old.players[0].fixer.length,6);assert.equal(old.players[0].gigs.length,0);
  assert.equal(transition(g,{type:'roll-in',dieId:'0-6',value:3}),g);assert.equal(g.players[0].fixer.length,5);
});
test('missing, opponent and already-used die IDs cannot be rolled in',()=>{
  const g=createGame();for(const dieId of [undefined,'1-4','not-a-die'])assert.equal(transition(g,{type:'roll-in',dieId,value:1}),g);
});
test('faces are validated against the selected die, including 10 and 20',()=>{
  const g=createGame();for(const value of [0,-1,5,2.5,NaN,Infinity])assert.equal(transition(g,{type:'roll-in',dieId:'0-4',value}),g);
  assert.equal(roll(g,10,10).players[0].gigs[0].value,10);
});
test('stealing moves the explicitly selected die rather than the last die',()=>{
  let g=mainPhase(setup(createGame(),[],['1-4','1-8','1-12']));const selected=structuredClone(g.players[1].gigs[0]);
  g=step(g,{type:'steal',player:0,dieId:'1-4'});assert.deepEqual(g.players[0].gigs[0],selected);assert.deepEqual(g.players[1].gigs.map(d=>d.id),['1-8','1-12']);
});
test('a stolen die keeps its original owner, type and face even after stealing it back',()=>{
  let g=mainPhase(setup(createGame(),[],['1-12']));g=step(g,{type:'set-value',player:1,dieId:'1-12',value:12});
  g=step(g,{type:'steal',player:0,dieId:'1-12'});assert.deepEqual(g.players[0].gigs[0],{id:'1-12',owner:1,sides:12,value:12});
  g=step(g,{type:'steal',player:1,dieId:'1-12'});assert.equal(g.players[1].gigs[0].owner,1);
});
test('multiple selected Gigs transfer atomically with no lost or duplicated dice',()=>{
  let g=mainPhase(setup(createGame(),[],['1-4','1-8','1-12']));g=step(g,{type:'steal',player:0,dieIds:['1-12','1-4']});
  assert.deepEqual(g.players[0].gigs.map(d=>d.id),['1-12','1-4']);assert.deepEqual(g.players[1].gigs.map(d=>d.id),['1-8']);
});
test('missing, duplicate and invalid steal selections leave the match unchanged',()=>{
  const g=mainPhase(setup(createGame(),[],['1-4']));for(const dieIds of [[],['1-4','1-4'],['1-4','1-20'],['0-4']])assert.equal(transition(g,{type:'steal',player:0,dieIds}),g);
  assert.equal(transition(g,{type:'steal',player:0}),g);
});
test('removing and restoring a selected Gig keeps the physical die and face',()=>{
  let g=setup(createGame(),['0-4','0-12']);g=step(g,{type:'remove',player:0,dieId:'0-4'});
  assert.equal(g.removed[0].id,'0-4');assert.deepEqual(g.players[0].gigs.map(d=>d.id),['0-12']);
  g=step(g,{type:'restore',player:1,dieId:'0-4'});assert.equal(g.players[1].gigs[0].owner,0);assert.equal(g.players[1].gigs[0].value,3);
});
test('stealing is locked for both players until the active player rolls their turn Gig',()=>{
  let g=setup(createGame(),['0-4'],['1-6']);
  assert.equal(needsTurnGig(g),true);assert.equal(canSteal(g),false);
  assert.equal(transition(g,{type:'steal',player:0,dieId:'1-6'}),g);
  assert.equal(transition(g,{type:'steal',player:1,dieId:'0-4'}),g);
  g=roll(g,8,2);assert.equal(needsTurnGig(g),false);assert.equal(canSteal(g),true);
  g=step(g,{type:'steal',player:0,dieId:'1-6'});assert.ok(g.players[0].gigs.some(d=>d.id==='1-6'));
});
test('editing and restoring dice do not satisfy the required setup roll',()=>{
  let g=setup(createGame(),['0-4'],['1-6']);g=step(g,{type:'set-value',player:1,dieId:'1-6',value:5});
  g=step(g,{type:'remove',player:0,dieId:'0-4'});g=step(g,{type:'restore',player:0,dieId:'0-4'});
  assert.equal(needsTurnGig(g),true);assert.equal(canSteal(g),false);
});
test('a new turn re-locks stealing, but an empty Fixer needs no roll',()=>{
  let g=mainPhase(setup(createGame(),['0-4'],['1-6']));assert.equal(canSteal(g),true);
  g=step(g,{type:'end-turn'});assert.equal(g.active,1);assert.equal(canSteal(g),false);
  assert.equal(transition(g,{type:'steal',player:1,dieId:'0-4'}),g);
  g=roll(g,8,2);assert.equal(canSteal(g),true);
  const empty=seventh();assert.equal(needsTurnGig(empty),false);assert.equal(canSteal(empty),true);
  assert.notEqual(transition(empty,{type:'steal',player:0,dieId:'1-4'}),empty);
});
test('a returned die goes to Fixer without a face and re-locks D20',()=>{
  let g=seventh();g=step(g,{type:'return-fixer',player:0,dieId:'0-20'});g=step(g,{type:'return-fixer',player:0,dieId:'0-4'});
  assert.equal(g.players[0].fixer[0].value,null);assert.deepEqual(legalFixerDice(g.players[0]).map(d=>d.sides),[4]);
});
test('editing and rerolling a face never changes the Gig count or die identity',()=>{
  let g=setup(createGame(),['0-12']);g=step(g,{type:'set-value',player:0,dieId:'0-12',value:12});
  assert.equal(g.players[0].gigs.length,1);assert.equal(g.players[0].gigs[0].value,12);
  assert.equal(transition(g,{type:'set-value',player:0,dieId:'0-12',value:13}),g);assert.equal(streetCred(g.players[0]),12);
});
test('the active player can adjust a rival Gig without changing control or turn state',()=>{
  const original=setup(createGame(),['0-4'],['1-6']);
  const g=step(original,{type:'set-value',player:1,dieId:'1-6',value:5});
  assert.equal(g.active,0);assert.equal(g.turn,original.turn);assert.equal(g.rolled,original.rolled);
  assert.equal(g.players[0].gigs[0].value,3);assert.equal(streetCred(g.players[1]),5);
  assert.deepEqual(g.players[1].gigs[0],{id:'1-6',owner:1,sides:6,value:5});
  assert.equal(original.players[1].gigs[0].value,3);
});
test('every Gig type accepts its endpoints and rejects faces outside its range',()=>{
  let g=setup(createGame(),DIE_TYPES.map(sides=>`0-${sides}`));
  for(const sides of DIE_TYPES){
    g=step(g,{type:'set-value',player:0,dieId:`0-${sides}`,value:1});
    g=step(g,{type:'set-value',player:0,dieId:`0-${sides}`,value:sides});
    for(const value of [0,sides+1,1.5])assert.equal(transition(g,{type:'set-value',player:0,dieId:`0-${sides}`,value}),g);
  }
  assert.equal(streetCred(g.players[0]),60);
});
test('seven Gigs wins only at the start of that player’s next regulation turn',()=>{
  let g=setup(createGame(),seven);assert.equal(g.result,null);g=step(g,{type:'end-turn'});assert.equal(g.result,null);
  g=step(g,{type:'end-turn'});assert.deepEqual(g.result.winners,[0]);assert.match(g.result.reason,/Began/);
});
test('rolling the seventh Gig during Start Phase does not win immediately',()=>{
  let g=setup(createGame(),seven.filter(id=>id!=='0-20'));g=roll(g,20,20);assert.equal(g.players[0].gigs.length,7);assert.equal(g.result,null);
});
test('overtime starts after both seventh turns with normal dice use',()=>{
  let g=seventh();assert.equal(g.turn,13);assert.equal(g.emptyStarts,1);assert.equal(g.overtime,false);
  g=step(g,{type:'end-turn'});assert.equal(g.turn,14);assert.equal(g.emptyStarts,2);assert.equal(g.overtime,false);
  g=step(g,{type:'end-turn'});assert.equal(g.overtime,true);assert.equal(g.turn,15);assert.equal(g.result,null);
});
test('second player holding seven wins at overtime entry before the next player acts',()=>{
  let g=step(seventh(),{type:'end-turn'});g=step(g,{type:'steal',player:1,dieId:'0-12'});assert.equal(g.result,null);
  g=step(g,{type:'end-turn'});assert.deepEqual(g.result.winners,[1]);assert.match(g.result.reason,/when overtime began/);assert.equal(g.active,1);
});
test('either player wins immediately on reaching seven in overtime',()=>{
  let g=step(step(seventh(),{type:'end-turn'}),{type:'end-turn'});g=step(g,{type:'steal',player:1,dieId:'0-4'});assert.deepEqual(g.result.winners,[1]);
});
test('changing starting player preserves the overtime boundary',()=>{
  let g=step(seventh(1),{type:'end-turn'});assert.equal(g.active,0);g=step(g,{type:'steal',player:0,dieId:'1-8'});g=step(g,{type:'end-turn'});assert.deepEqual(g.result.winners,[0]);
});
test('skipped rolls delay overtime rather than applying a fixed round cutoff',()=>{
  let g=createGame();for(let i=0;i<20;i++)g=step(g,{type:'end-turn'});assert.equal(g.overtime,false);assert.equal(g.players[0].fixer.length,6);
});
test('Fixer changes do not rewrite whether the current turn began empty',()=>{
  let g=seventh();g=step(g,{type:'return-fixer',player:1,dieId:'1-4'});assert.equal(g.emptyStarts,1);
  g=step(g,{type:'end-turn'});assert.equal(g.emptyStarts,0);assert.equal(g.overtime,false);
});
test('physical setup rejects duplicate, missing and impossible die assignments',()=>{
  const g=createGame(),inventory=allDice().map(d=>({id:d.id,zone:`${d.owner}-fixer`,value:1}));
  const missing=inventory.slice(1);assert.equal(transition(g,{type:'settings',inventory:missing}),g);
  const duplicate=structuredClone(inventory);duplicate[1].id=duplicate[0].id;assert.equal(transition(g,{type:'settings',inventory:duplicate}),g);
  const invalid=structuredClone(inventory);invalid[0]={id:'0-4',zone:'0-gigs',value:5};assert.equal(transition(g,{type:'settings',inventory:invalid}),g);
});
test('old fresh matches upgrade automatically to the correct full sets',()=>{
  const old=asLegacy(createGame()),g=migrateGame(old);assert.ok(isValidGame(g));assert.equal(g.needsDiceReview,false);assert.deepEqual(g.players[0].fixer.map(d=>d.sides),DIE_TYPES);assert.equal(old.version,1);
});
test('an older empty match after turn one still requires explicit dice review',()=>{
  const old=asLegacy(createGame());old.turn=3;old.players[0].turns=1;old.players[1].turns=1;
  const g=migrateGame(old);assert.equal(g.needsDiceReview,true);assert.equal(g.turn,3);assert.equal(g.players[0].fixer.length,6);
});
test('no Gigs means Null Street Cred, rather than zero',()=>{
  assert.equal(streetCred(createGame().players[0]),null);
});
test('starting, rolling and resuming keep the other player empty without corrupting totals',()=>{
  for(const first of [0,1]){
    const original=createGame(['Player One','Player Two'],first);
    const rolled=roll(original,12,12);
    const resumed=migrateGame(JSON.parse(JSON.stringify(rolled)));
    assert.ok(isValidGame(resumed));
    assert.equal(resumed.players[first].gigs.length,1);
    assert.equal(streetCred(resumed.players[first]),12);
    assert.equal(resumed.players[1-first].gigs.length,0);
    assert.equal(streetCred(resumed.players[1-first]),null);
    assert.equal(canSteal(resumed),true);
    const next=step(resumed,{type:'end-turn'});
    assert.equal(next.active,1-first);
    assert.equal(needsTurnGig(migrateGame(JSON.parse(JSON.stringify(next)))),true);
    assert.equal(canSteal(next),false);
    assert.equal(original.players[first].gigs.length,0);
  }
});
test('taking the last opposing Gig clears only that player’s Street Cred and can be restored from a snapshot',()=>{
  let g=roll(createGame(),12,12);g=step(g,{type:'end-turn'});g=roll(g,6,3);
  const before=JSON.parse(JSON.stringify(g));
  g=step(g,{type:'steal',player:1,dieId:'0-12'});
  assert.equal(g.players[0].gigs.length,0);assert.equal(streetCred(g.players[0]),null);
  assert.equal(g.players[1].gigs.length,2);assert.equal(streetCred(g.players[1]),15);
  const restored=migrateGame(before);
  assert.equal(streetCred(restored.players[0]),12);assert.equal(streetCred(restored.players[1]),3);
  g=step(g,{type:'remove',player:1,dieId:'1-6'});
  g=step(g,{type:'return-fixer',player:1,dieId:'0-12'});
  assert.equal(g.players[1].gigs.length,0);assert.equal(streetCred(g.players[1]),null);
  g=step(g,{type:'restore',player:0,dieId:'1-6'});
  assert.equal(g.players[0].gigs.length,1);assert.equal(streetCred(g.players[0]),3);
});
test('old in-progress saves preserve counts, turns and faces without guessing types or owners',()=>{
  const old=asLegacy(roll(createGame(),8,3));old.turn=5;old.players[0].turns=2;const g=migrateGame(old);
  assert.ok(isValidGame(g));assert.equal(g.needsDiceReview,true);assert.equal(g.turn,5);assert.equal(g.players[0].gigs[0].value,3);assert.equal(g.players[0].gigs[0].sides,null);assert.equal(g.players[0].gigs[0].owner,null);assert.equal(g.players[0].fixer.length,5);
  assert.equal(transition(g,{type:'end-turn'}),g);
});
test('reviewing an old save resumes it without resetting turns and keeps undo snapshots valid',()=>{
  const old=migrateGame(asLegacy(roll(createGame(),8,3)));const g=setup(old,['0-8']);assert.equal(g.needsDiceReview,false);assert.equal(g.turn,old.turn);assert.equal(g.rolled,old.rolled);assert.ok(isValidGame(old));
});
test('malformed saved matches and out-of-range faces are rejected safely',()=>{
  assert.equal(migrateGame({}),null);assert.equal(isValidGame(null),false);
  const g=createGame();for(const update of [{players:[null,null]},{log:[null]},{active:2},{turn:-1},{result:{winners:[0,0],reason:'bad'}}])assert.equal(isValidGame({...g,...update}),false);
  const duplicate=structuredClone(g);duplicate.players[1].fixer[0].id='0-4';assert.equal(isValidGame(duplicate),false);
});
test('all die types generate valid minimum and maximum faces',()=>{
  for(const sides of DIE_TYPES){assert.equal(rollDie(sides,()=>0),1);assert.equal(rollDie(sides,()=>.999999),sides);}assert.throws(()=>rollDie(7),RangeError);
});
test('deck-out freezes the match while winner data survives save and restore',()=>{
  const g=step(createGame(),{type:'manual-result',player:1,reason:'deck-out'});assert.deepEqual(g.result.winners,[1]);assert.equal(transition(g,{type:'end-turn'}),g);assert.ok(isValidGame(JSON.parse(JSON.stringify(g))));
});
