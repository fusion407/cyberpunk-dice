// Each Gig is a physical die. Stealing changes control, not owner or face.
export const TARGET = 7;
export const LIMIT = 12;
export const DIE_TYPES = [4, 6, 8, 10, 12, 20];
export const RULES_URL = 'https://cyberpunktcg.com/comprehensive-rules';
export const allDice = () => [0, 1].flatMap(owner => DIE_TYPES.map(sides => ({ id: `${owner}-${sides}`, owner, sides, value: null })));
export const legalFixerDice = p => p.fixer.filter(d => d.sides && (d.sides !== 20 || p.fixer.length === 1));
export const needsTurnGig = g => !g.result && !g.needsDiceReview && !g.rolled && g.players[g.active].fixer.length > 0;
export const canSteal = g => !g.result && !g.needsDiceReview && !needsTurnGig(g);
export const streetCred = p => p.gigs.length ? p.gigs.reduce((sum, d) => sum + d.value, 0) : null;
const validFace = (sides, value) => Number.isInteger(value) && value >= 1 && value <= sides;
export function createGame(names = ['Player One', 'Player Two'], first = 0) {
  return { version: 2, needsDiceReview: false, players: names.map((name, owner) => ({name:name.trim().slice(0,24) || `Player ${owner+1}`, gigs:[], fixer:allDice().filter(d=>d.owner===owner), turns:0})), removed:[], active:first, first, turn:1, emptyStarts:0, overtime:false, rolled:false, result:null, log:[{text:`${names[first]} starts the match.`,type:'turn',turn:1}] };
}
export function rollDie(sides=6, random=Math.random) {
  if (!DIE_TYPES.includes(sides)) throw new RangeError('Unsupported die type');
  return Math.floor(random()*sides)+1;
}
function log(g,text,type='gig') { g.log.unshift({text,type,turn:g.turn}); g.log=g.log.slice(0,100); }
function declare(g,winners,reason) { g.result={winners,reason}; log(g,winners.length>1?'Draw: simultaneous victory.':`${g.players[winners[0]].name} wins! ${reason}`,'win'); }
function checkOvertime(g,entry=false) {
  const winners=g.players.flatMap((p,i)=>p.gigs.length>=TARGET?[i]:[]);
  if(winners.length) declare(g,winners,entry?'Held 7+ Gigs when overtime began.':'Reached 7 Gigs during overtime.');
}
function applyInventory(g,inventory) {
  const zones=['0-fixer','0-gigs','1-fixer','1-gigs','removed'];
  if(!Array.isArray(inventory)||inventory.length!==12||new Set(inventory.map(e=>e?.id)).size!==12) return false;
  const assignments=allDice().map(die=>({die,entry:inventory.find(e=>e?.id===die.id)}));
  if(assignments.some(({die,entry})=>!entry||!zones.includes(entry.zone)||(entry.zone.endsWith('gigs')&&!validFace(die.sides,entry.value)))) return false;
  g.players.forEach(p=>{p.gigs=[];p.fixer=[];});g.removed=[];
  for(const {die,entry} of assignments){
    die.value=entry.zone.endsWith('fixer')?null:validFace(die.sides,entry.value)?entry.value:1;
    if(entry.zone==='removed')g.removed.push(die);
    else {const [player,zone]=entry.zone.split('-');g.players[Number(player)][zone].push(die);}
  }
  g.needsDiceReview=false;return true;
}
export function transition(previous,action) {
  if(previous.result||(previous.needsDiceReview&&action.type!=='settings'))return previous;
  const g=structuredClone(previous),player=action.player??g.active;
  if(![0,1].includes(player))return previous;
  const p=g.players[player],rival=g.players[1-player];
  switch(action.type){
    case 'roll-in': {
      const current=g.players[g.active],index=current.fixer.findIndex(d=>d.id===action.dieId);
      if(g.rolled||index<0||!legalFixerDice(current).some(d=>d.id===action.dieId))return previous;
      const die=current.fixer[index],value=action.value??rollDie(die.sides);
      if(!validFace(die.sides,value))return previous;
      current.fixer.splice(index,1);die.value=value;current.gigs.push(die);g.rolled=true;
      log(g,`${current.name} rolled in D${die.sides}: ${value}. ${current.gigs.length} Gigs in play.`,'roll');break;
    }
    case 'steal': {
      if(!canSteal(g))return previous;
      const ids=action.dieIds??(action.dieId?[action.dieId]:[]);
      if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!rival.gigs.some(d=>d.id===id)))return previous;
      const selected=ids.map(id=>rival.gigs.find(d=>d.id===id));rival.gigs=rival.gigs.filter(d=>!ids.includes(d.id));p.gigs.push(...selected);
      log(g,`${p.name} stole ${selected.map(d=>`D${d.sides} (${d.value})`).join(', ')} from ${rival.name}.`);break;
    }
    case 'remove':case 'return-fixer': {
      const index=p.gigs.findIndex(d=>d.id===action.dieId);if(index<0)return previous;
      const [die]=p.gigs.splice(index,1);
      if(action.type==='return-fixer'){die.value=null;p.fixer.push(die);}else g.removed.push(die);
      log(g,`${p.name} ${action.type==='return-fixer'?'returned':'removed'} D${die.sides}${action.type==='return-fixer'?' to Fixer':' from play'}.`);break;
    }
    case 'restore': {
      const index=g.removed.findIndex(d=>d.id===action.dieId);if(index<0)return previous;
      const die=g.removed[index],value=action.value??die.value;if(!validFace(die.sides,value))return previous;
      g.removed.splice(index,1);die.value=value;p.gigs.push(die);log(g,`${p.name} restored D${die.sides} (${value}).`);break;
    }
    case 'set-value': {
      const die=p.gigs.find(d=>d.id===action.dieId);if(!die||!validFace(die.sides,action.value))return previous;
      die.value=action.value;log(g,`${p.name} set D${die.sides} to ${die.value}.`,'roll');break;
    }
    case 'end-turn': {
      const current=g.players[g.active];current.turns++;log(g,`${current.name} ended turn ${current.turns}.`,'turn');
      if(!g.overtime&&g.emptyStarts>=2){g.overtime=true;log(g,'Overtime began. Seven Gigs now wins immediately.','overtime');checkOvertime(g,true);if(g.result)break;}
      g.active=1-g.active;g.turn++;g.rolled=false;const next=g.players[g.active];g.emptyStarts=next.fixer.length===0?g.emptyStarts+1:0;
      log(g,`${next.name} began turn ${next.turns+1}.`,'turn');
      if(!g.overtime&&next.gigs.length>=TARGET)declare(g,[g.active],'Began their turn with 7+ Gigs.');break;
    }
    case 'settings':
      if(action.inventory&&!applyInventory(g,action.inventory))return previous;
      if(g.needsDiceReview)return previous;
      if(action.names)for(let i=0;i<2;i++)g.players[i].name=String(action.names[i]).trim().slice(0,24)||`Player ${i+1}`;
      log(g,'Player / physical dice setup updated.','edit');break;
    case 'manual-result':declare(g,[player],action.reason==='deck-out'?'Their rival was required to draw from an empty deck.':'Their rival conceded.');break;
    default:return previous;
  }
  if(g.overtime&&!g.result)checkOvertime(g);return g;
}
export function isValidGame(g) {
  if(!g||g.version!==2||typeof g.needsDiceReview!=='boolean'||!Array.isArray(g.players)||g.players.length!==2||!Array.isArray(g.removed))return false;
  if(!g.players.every(p=>p&&typeof p.name==='string'&&p.name.length<=24&&Array.isArray(p.gigs)&&Array.isArray(p.fixer)&&p.gigs.length<=24&&p.fixer.length<=24&&Number.isInteger(p.turns)&&p.turns>=0))return false;
  if(![0,1].includes(g.active)||![0,1].includes(g.first)||!Number.isInteger(g.turn)||g.turn<1||!Number.isInteger(g.emptyStarts)||g.emptyStarts<0||typeof g.rolled!=='boolean'||typeof g.overtime!=='boolean')return false;
  if(g.result!==null&&(!g.result||!Array.isArray(g.result.winners)||!g.result.winners.length||g.result.winners.length>2||new Set(g.result.winners).size!==g.result.winners.length||!g.result.winners.every(i=>[0,1].includes(i))||typeof g.result.reason!=='string'))return false;
  if(!Array.isArray(g.log)||g.log.length>100||!g.log.every(e=>e&&typeof e.text==='string'&&typeof e.type==='string'&&Number.isInteger(e.turn)))return false;
  const zones=g.players.flatMap(p=>[{dice:p.gigs,fixer:false},{dice:p.fixer,fixer:true}]).concat({dice:g.removed,fixer:false});const dice=zones.flatMap(z=>z.dice);
  if(dice.some(d=>!d||typeof d.id!=='string')||new Set(dice.map(d=>d.id)).size!==dice.length)return false;
  if(g.needsDiceReview)return zones.every(z=>z.dice.every(d=>d.sides===null&&d.owner===null&&(z.fixer?d.value===null:validFace(20,d.value))));
  const canonical=allDice();return dice.length===12&&zones.every(z=>z.dice.every(d=>canonical.some(ref=>ref.id===d.id&&ref.owner===d.owner&&ref.sides===d.sides)&&(z.fixer?d.value===null:validFace(d.sides,d.value))));
}
// Preserve older saves without pretending their unrecorded die types are known.
export function migrateGame(previous){
  if(isValidGame(previous))return previous;
  if(!previous||previous.version!==1||!Array.isArray(previous.players)||previous.players.length!==2)return null;
  if(!previous.players.every(p=>p&&Array.isArray(p.gigs)&&p.gigs.length<=24&&p.gigs.every(v=>validFace(6,v))&&Number.isInteger(p.fixer)&&p.fixer>=0&&p.fixer<=24))return null;
  const g=structuredClone(previous);g.version=2;g.removed=[];g.needsDiceReview=g.turn!==1||g.rolled||g.players.some(p=>p.turns!==0||p.gigs.length||p.fixer!==6);
  g.players.forEach((p,owner)=>{p.gigs=p.gigs.map((value,i)=>({id:`legacy-${owner}-gig-${i}`,owner:null,sides:null,value}));p.fixer=g.needsDiceReview?Array.from({length:p.fixer},(_,i)=>({id:`legacy-${owner}-fixer-${i}`,owner:null,sides:null,value:null})):allDice().filter(d=>d.owner===owner);});
  return isValidGame(g)?g:null;
}
