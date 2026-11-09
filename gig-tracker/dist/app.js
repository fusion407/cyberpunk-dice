import { createGame, transition, migrateGame, DIE_TYPES, allDice, legalFixerDice, needsTurnGig, canSteal, streetCred, RULES_URL } from './game.js';
import { FEEDBACK_STORAGE, SOUND_FILES, createSoundPlayer, feedbackForAction, showPlayerEffect, showVsEffect, clearEffects } from './feedback.js';
import { setupInstall, installHelp } from './install.js';
import { createRollReveal } from './roll-reveal.js';
const $ = id => document.getElementById(id);
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE = 'gig-tracker:match:v1';
const VIEW_STORAGE = 'gig-tracker:table-view:v1';
const tableViewport = window.matchMedia('(max-width: 1200px), (any-pointer: coarse)');
let game = createGame(), history = [], storageAvailable = true;
let diceQuantity = 1, quickSides = 6, lastQuickSides = 6, quickResults = [], rolling = false;
let toastTimer, modalKind = null, modalContext = {}, selectedDieId = null;
let preferTableView = false, tableView = false, standardScrollY = 0, dialogViewer = 0;
const tableRolls = [null, null];
let feedbackStorage;
try { feedbackStorage = localStorage; } catch { /* Sound still works without persistent storage. */ }
const sound = createSoundPlayer({ storage: feedbackStorage });
const rollReveal = createRollReveal({ dialog: $('roll-reveal'), getSettings: () => sound.settings, playSound: id => sound.play(id) });
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE));
  const restored = migrateGame(saved?.game);
  if (restored) { game = restored; history = Array.isArray(saved.history) ? saved.history.map(migrateGame).filter(Boolean).slice(-100) : []; }
  preferTableView = localStorage.getItem(VIEW_STORAGE) === 'true';
} catch { /* An unavailable or malformed save must not prevent play. */ }
function applyView() {
  const next = tableViewport.matches && preferTableView, changed = next !== tableView;
  if (next && !tableView) standardScrollY = window.scrollY;
  tableView = next; document.body.classList.toggle('table-view', tableView);
  $('modal').classList.toggle('table-top-dialog', tableView && dialogViewer === 1);
  const toggle = $('view-toggle');
  if (toggle) { const label = tableView ? 'Return to standard view' : 'Switch to face-to-face table view'; toggle.setAttribute('aria-pressed', String(tableView)); toggle.setAttribute('aria-label', label); toggle.title = label; }
  if (changed) window.scrollTo(0, tableView ? 0 : standardScrollY);
}
tableViewport.addEventListener('change', applyView);
// Rejection sampling remains unbiased for every supported polyhedral die.
function randomDie(sides = 6) {
  if (!globalThis.crypto?.getRandomValues) return Math.floor(Math.random() * sides) + 1;
  const bytes = new Uint8Array(1), ceiling = Math.floor(256 / sides) * sides;
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= ceiling);
  return bytes[0] % sides + 1;
}
function save() { try { localStorage.setItem(STORAGE, JSON.stringify({game,history})); storageAvailable = true; } catch { storageAvailable = false; } }
function notify(text) { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200); }
function commit(next, action = null, quiet = false) {
  if (next === game) return;
  const feedback = feedbackForAction(game, next, action);
  const hadWinner = !!game.result;
  history.push(structuredClone(game)); history = history.slice(-100); game = next; save(); render();
  if (feedback && !quiet) { sound.play(feedback.effect); if (sound.settings.effects) showPlayerEffect(feedback); }
  if (game.result && !hadWinner) {
    const target = tableView ? document.querySelector(`.player-card[data-player="${game.result.winners[0]}"] .table-result`) : $('match-announcement');
    target.setAttribute('tabindex','-1'); target.focus({preventScroll:tableView}); navigator.vibrate?.([60,50,100]);
  }
}
function dispatch(action) { commit(transition(game, action), action); }
const diceIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 9 6v8l-9 6-9-6V8l9-6Z M3 8l9 5 9-5M12 13v9"/></svg>';
const settingsIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6m8 4v6"/></svg>';
const soundIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4Z"/><path class="sound-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-off" d="m15 9 6 6m0-6-6 6"/></svg>';
function soundToggle() { return `<button class="icon-button sound-toggle" data-action="toggle-sound" aria-label="Mute sound effects" aria-pressed="true">${soundIcon}</button>`; }
function renderSoundControls() {
  const settings = sound.settings, enabled = !settings.muted && settings.volume > 0;
  document.querySelectorAll('[data-action="toggle-sound"]').forEach(button => {
    button.innerHTML = soundIcon; button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Mute sound effects' : 'Enable sound effects');
    button.title = enabled ? 'Mute sound effects' : 'Enable sound effects';
  });
  if ($('sound-enabled')) $('sound-enabled').checked = !settings.muted;
  if ($('effects-enabled')) $('effects-enabled').checked = settings.effects;
  if ($('sound-volume')) $('sound-volume').value = String(Math.round(settings.volume * 100));
  if ($('sound-volume-label')) $('sound-volume-label').textContent = `${Math.round(settings.volume * 100)}%`;
  document.querySelectorAll('[data-action="preview-sound"]').forEach(button => { button.disabled = !enabled; });
}
function soundSettings() {
  return `<fieldset class="feedback-settings"><legend>Sound & effects</legend><label class="feedback-option" for="sound-enabled">Sound effects<input id="sound-enabled" type="checkbox"></label><label class="feedback-option" for="sound-volume">Volume <output id="sound-volume-label" for="sound-volume"></output></label><div class="feedback-option"><input id="sound-volume" type="range" min="0" max="100" step="5" aria-label="Sound effects volume"></div><label class="feedback-option" for="effects-enabled">Visual effects<input id="effects-enabled" type="checkbox"></label><p class="form-note">Steals hit the rival’s side. New Gigs trigger a quickhack or braindance; saved face changes play the eddies cue. Preferences save immediately.</p><div class="sound-previews" role="group" aria-label="Preview sound effects">${Object.keys(SOUND_FILES).map(id => `<button type="button" class="outline-button" data-action="preview-sound" data-sound="${id}">▶ ${{shock:'Short circuit',slash:'Katana slash',quickhack:'Quickhack',braindance:'Braindance',eddies:'Eddies',vs:'VS button',roll:'Dice reveal',maxFace:'Max Face'}[id]}</button>`).join('')}</div></fieldset>`;
}
function die(value, extra = '', sides = 6) { return `<span class="poly-die ${extra}" role="img" aria-label="D${sides} showing ${value}"><small>D${sides}</small><strong>${value}</strong></span>`; }
function gigToken(d, player) { return `<button class="gig-token owner-${d.owner}" data-action="edit-gig" data-player="${player}" data-die="${esc(d.id)}" aria-label="Edit ${esc(game.players[player].name)} Gig: D${d.sides ?? '?'} showing ${d.value}, owned by ${esc(game.players[d.owner]?.name ?? 'unrecorded')}" ${game.result || game.needsDiceReview ? 'disabled' : ''}><small>D${d.sides ?? '?'}</small><strong>${d.value}</strong><i>${d.owner===null?'?':d.owner+1}</i></button>`; }
function playerCard(p, index) {
  const current = index === game.active && !game.result, won = game.result?.winners.includes(index), count = p.gigs.length;
  const blocked = !!game.result || game.needsDiceReview;
  const status = game.result ? won ? game.result.winners.length===2 ? 'DRAW' : 'WINNER' : 'MATCH OVER' : current ? needsTurnGig(game) ? '● ROLL YOUR GIG' : '● YOUR TURN' : 'STANDING BY';
  const rack = p.gigs.map(d => gigToken(d,index)).join('') || '<span class="empty-gigs">NO GIGS IN PLAY</span>';
  const rollDisabled = blocked || game.rolled || !p.fixer.length;
  const playerTurn = p.turns + (current ? 1 : 0);
  const resultText = game.result ? game.result.winners.length===2 ? 'MATCH DRAWN' : won ? 'YOU WIN' : 'RIVAL WINS' : count>=7 ? 'HOLD UNTIL YOUR NEXT TURN TO WIN' : '';
  const free = tableRolls[index];
  const cred = streetCred(p);
  const credDescription = cred === null ? 'No Gigs yet' : String(cred);
  return `<article class="player-card ${index===1?'player-two':''} ${current?'active':''} ${won?'winner':''}" data-player="${index}" aria-label="${esc(p.name)}${current?', active player':''}">
    <div class="table-only table-turn-track" aria-label="${esc(p.name)} turn progress"><span>TURN <b>${String(Math.max(1,playerTurn)).padStart(2,'0')}</b><small>${game.overtime?'OVERTIME':'/ 07'}</small></span><div class="table-turn-markers">${Array.from({length:7},(_,i)=>`<span class="table-turn-marker ${p.turns>i?'done':current&&p.turns===i?'current':''}">${i+1}</span>`).join('')}</div></div>
    <div class="player-heading"><div class="player-identity"><span class="player-number">0${index+1}</span><div><h2>${esc(p.name)}</h2><small>${index===game.first?'FIRST TO PLAY':'SECOND TO PLAY'}</small></div></div><span class="player-status">${status}</span></div>
    <div class="player-main"><div class="gig-count"><span class="count-number" aria-live="polite" aria-label="${count} Gig dice">${count}</span><div class="count-details"><strong>/ 7</strong><span>GIG DICE</span><span class="street-cred" title="${credDescription}" aria-label="${esc(p.name)} Street Cred: ${credDescription}" aria-live="polite"><span class="cred-label">STREET CRED</span><strong class="cred-value ${cred === null ? 'cred-empty' : ''}">${cred ?? 'No Gigs yet'}</strong></span></div></div><div class="table-only table-quick-roll"><button class="table-roll-button" data-action="table-roll" data-player="${index}" aria-label="Choose a free die to roll for ${esc(p.name)}"><span class="table-roll-output" aria-live="polite">${free?.value ?? diceIcon}</span><span>${free?'D'+free.sides+' · ROLL':'ROLL DIE'}</span></button><small>FREE ROLL · NO GIG CHANGE</small></div></div>
    <div class="gig-rack" aria-label="${esc(p.name)} Gig dice">${rack}</div>
    <div class="counter-controls"><button data-action="remove" data-player="${index}" aria-label="Choose a Gig to remove from ${esc(p.name)}" ${!count||blocked?'disabled':''}>−</button><button class="steal-button" data-action="steal" data-player="${index}" aria-label="Choose Gigs for ${esc(p.name)} to steal" title="${needsTurnGig(game)?'The active player must roll their turn Gig before stealing.':'Choose the exact rival Gigs to steal.'}" ${!game.players[1-index].gigs.length||!canSteal(game)?'disabled':''}>⇄ Steal</button><button data-action="add" data-player="${index}" aria-label="Add or restore a Gig for ${esc(p.name)}" ${blocked?'disabled':''}>+</button></div>
    <div class="pending-win">${count>=7&&!game.overtime&&!game.result?'HOLD UNTIL YOUR NEXT TURN TO WIN':won?'NIGHT CITY IS YOURS.':'&nbsp;'}</div>
    <div class="reserve"><span>FIXER</span><div class="reserve-amount" aria-label="${p.fixer.length} dice in Fixer">${p.fixer.map(d=>`<span class="reserve-die ${d.sides===20&&p.fixer.length>1?'locked':''}" title="${d.sides===20&&p.fixer.length>1?'D20 is locked until the other Fixer dice are used':'Available in Fixer'}">D${d.sides??'?'}</span>`).join('')||'<b>EMPTY</b>'}</div>${current?`<button class="reserve-roll" data-action="roll-in" ${rollDisabled?'disabled':''}>${diceIcon}${game.rolled?'GIG ROLLED IN':!p.fixer.length?'RESERVE EMPTY':'CHOOSE GIG'}</button>`:`<span class="reserve-wait">${p.turns} TURNS COMPLETED</span>`}</div>
    <div class="table-only table-footer"><div class="table-result ${resultText?'has-result':''}" aria-live="polite">${resultText?`<strong>${resultText}</strong>${game.result?`<span>${esc(game.result.reason)}</span>`:''}`:''}</div><div class="table-actions"><button class="icon-button" data-action="settings" aria-label="Match settings for ${esc(p.name)}">${settingsIcon}</button><button class="table-undo" data-action="undo" aria-label="Undo last action for ${esc(p.name)}" ${!history.length?'disabled':''}>↶ Undo</button>${game.result?'<button class="primary-button table-end-turn" data-action="new-game">New match ↗</button>':`<button class="primary-button table-end-turn" data-action="end-turn" data-player="${index}" aria-label="End ${esc(p.name)}’s turn" ${!current||blocked?'disabled':''}>${current?'End turn →':'Waiting for rival'}</button>`}</div></div>
  </article>`;
}
function renderReview() {
  $('dice-review').hidden = !game.needsDiceReview || !!game.result;
  $('dice-review').classList.toggle('table-review',tableView);
}
function render() {
  rollReveal.close();
  clearEffects();
  $('scoreboard').innerHTML = game.players.map(playerCard).join('') + '<span class="vs-badge desktop-vs" aria-hidden="true">VS</span><button id="view-toggle" class="view-toggle" data-action="toggle-table" aria-label="Switch to face-to-face table view" aria-pressed="false" aria-controls="scoreboard"><span>VS</span></button>';
  $('match-state').textContent = game.result ? 'MATCH COMPLETE' : game.overtime ? 'OVERTIME / SUDDEN DEATH' : 'MATCH IN PROGRESS';
  const round = Math.ceil(game.turn / 2);
  $('turn-title').innerHTML = `Round ${String(round).padStart(2, '0')} <span>${game.overtime ? '/ OT' : '/ 07'}</span>`;
  $('phase-badge').textContent = game.result ? 'MATCH COMPLETE' : game.overtime ? 'OVERTIME' : 'REGULATION';
  $('phase-badge').classList.toggle('overtime', game.overtime && !game.result);
  $('timeline').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const r = i + 1;
    const slots = [game.first, 1 - game.first].map((index) => {
      const complete = game.players[index].turns >= r;
      const active = !game.result && game.active === index && game.players[index].turns + 1 === r;
      return `<span class="step-slot ${complete ? 'done' : active ? 'current' : ''}" title="${esc(game.players[index].name)} turn ${r}: ${complete ? 'complete' : active ? 'current' : 'upcoming'}"></span>`;
    }).join('');
    return `<div class="round-step ${round === r && !game.overtime ? 'current' : ''}"><div class="step-label"><span>0${r}</span>${round === r && !game.overtime && !game.result ? '<span>↓</span>' : ''}</div><div class="step-slots">${slots}</div></div>`;
  }).join('') + `<div class="round-step ot ${game.overtime ? 'current' : ''}"><div class="step-label">OVERTIME</div><div class="step-slots"><span class="step-slot"></span></div></div>`;
  const active = game.players[game.active];
  $('current-turn-name').textContent = game.result ? 'Match concluded' : `${active.name}’s turn · ${active.turns + 1}`;
  document.querySelector('.turn-indicator').style.background = game.active === 0 ? 'var(--cyan)' : 'var(--yellow)';
  $('turn-hint').textContent = game.result ? game.result.reason : needsTurnGig(game) ? 'Setup phase: roll your Gig from Fixer before stealing.' : game.overtime ? 'Sudden death. Seven Gigs wins immediately, for either player.' : game.rolled ? 'Gig rolled in. Play your turn, then pass to your rival.' : 'Fixer empty. Play your turn, then pass to your rival.';
  $('overtime-note').textContent = game.overtime ? 'Overtime is active. Gig totals are checked after every change.' : game.emptyStarts >= 2 ? 'Overtime begins when this turn ends. Both players started with empty Fixers.' : game.emptyStarts === 1 ? 'First empty-Fixer start recorded. Waiting for the next turn’s check.' : 'Overtime normally begins after both players finish turn 7.';
  $('end-turn').disabled = !!game.result || game.needsDiceReview;
  $('undo').disabled = !history.length;
  $('match-announcement').innerHTML = game.result ? `<div><span class="eyebrow">${game.result.winners.length === 2 ? 'SIMULTANEOUS VICTORY' : 'VICTORY CONFIRMED'}</span><strong>${game.result.winners.length === 2 ? 'The match is a draw.' : `${esc(game.players[game.result.winners[0]].name)} wins.`}</strong><p>${esc(game.result.reason)}</p></div><button class="text-button" data-action="new-game">Play again ↗</button>` : game.overtime ? '<div><strong>Welcome to overtime.</strong><p>First to seven Gigs wins immediately. Every move counts.</p></div>' : '';
  $('log-count').textContent = `${String(game.log.length).padStart(2, '0')} ${game.log.length === 1 ? 'EVENT' : 'EVENTS'}`;
  $('match-log').innerHTML = game.log.map((entry) => `<div class="log-entry ${esc(entry.type)}"><span>T${String(entry.turn).padStart(2, '0')}</span><p>${esc(entry.text)}</p></div>`).join('');
  document.querySelector('.log-footer>span').innerHTML = `<i></i> ${storageAvailable ? 'AUTOSAVED ON THIS DEVICE' : 'STORAGE UNAVAILABLE · KEEP APP OPEN'}`;
  renderRoller();
  applyView();
  renderReview();
  document.querySelectorAll('.table-actions').forEach(actions => actions.insertAdjacentHTML('afterbegin', soundToggle()));
  if (!document.querySelector('.header-right .sound-toggle')) document.querySelector('.header-right').insertAdjacentHTML('afterbegin', soundToggle());
  renderSoundControls();
}
function renderRoller() {
  $('dice-quantity').textContent = `${diceQuantity} ${diceQuantity===1?'die':'dice'}`;
  $('quick-type').value = String(quickSides);
  $('quick-roll-label').textContent = `D${quickSides} / FREE ROLL`;
  document.querySelector('[data-action="less-dice"]').disabled = diceQuantity===1 || rolling;
  document.querySelector('[data-action="more-dice"]').disabled = diceQuantity===6 || rolling;
  $('quick-roll').disabled = rolling;
  $('quick-type').disabled = rolling;
  $('roll-results').innerHTML = quickResults.length ? quickResults.map(v=>die(v,'',lastQuickSides)).join('') : die('–','die-placeholder',quickSides);
  $('roll-summary').innerHTML = quickResults.length ? `LAST ROLL / ${quickResults.length}D${lastQuickSides}<br>TOTAL <b>${quickResults.reduce((a,b)=>a+b,0)}</b>` : 'READY WHEN<br>YOU ARE';
}
function quickRoll() {
  if(rolling)return;
  rolling=true;lastQuickSides=quickSides;quickResults=Array.from({length:diceQuantity},()=>randomDie(quickSides));renderRoller();
  rollReveal.show({ sides:lastQuickSides, values:quickResults, title:'Quick roll', subtitle:'Free roll · '+diceQuantity+'D'+lastQuickSides, note:'Free roll · Your match is unchanged.', onSettled:()=>{rolling=false;renderRoller();} });
}
const closeButton = '<button class="icon-button" data-action="close-modal" type="button" aria-label="Close dialog">×</button>';
const modalHeading = title => `<div class="modal-heading"><h2 id="modal-title">${title}</h2>${closeButton}</div>`;
function inventoryEditor() {
  const zones = [['0-fixer','P1 Fixer'],['0-gigs','P1 Gigs'],['1-fixer','P2 Fixer'],['1-gigs','P2 Gigs'],['removed','Out of play']];
  return `<details class="dice-setup" ${game.needsDiceReview?'open':''}><summary>Physical dice setup / card-effect corrections</summary><p class="form-note">One of each die belongs to each player. Choose where every physical die is now and its face if in play. This corrects the table without advancing a turn.</p>${game.needsDiceReview?'<p class="migration-explanation">Your previous counts and turn history are preserved. Old saves did not identify die types: set all 12 dice to match the table before continuing.</p>':''}<div class="inventory-head"><span>ORIGINAL OWNER / DIE</span><span>LOCATION</span><span>FACE</span></div>${allDice().map(d=>{
    let zone=game.needsDiceReview?'':`${d.owner}-fixer`,value=1;
    for(let i=0;i<2;i++)for(const area of ['fixer','gigs']){const found=game.players[i][area].find(item=>item.id===d.id);if(found){zone=`${i}-${area}`;value=found.value??1;}}
    const removed=game.removed.find(item=>item.id===d.id);if(removed){zone='removed';value=removed.value??1;}
    return `<div class="inventory-row"><label for="zone-${d.id}">P${d.owner+1} · D${d.sides}</label><select id="zone-${d.id}" name="zone-${d.id}" aria-label="Location of Player ${d.owner+1} D${d.sides}" required>${game.needsDiceReview?'<option value="">Choose…</option>':''}${zones.map(([id,label])=>`<option value="${id}" ${zone===id?'selected':''}>${label}</option>`).join('')}</select><input name="face-${d.id}" type="number" min="1" max="${d.sides}" value="${value}" required aria-label="Face of Player ${d.owner+1} D${d.sides}"></div>`;
  }).join('')}</details>`;
}
function showModal(kind, viewer=game.active, context={}) {
  modalKind=kind;modalContext=context;dialogViewer=viewer;
  const modal=$('modal');modal.classList.toggle('table-top-dialog',tableView&&viewer===1);
  if(kind==='roll-in') {
    const p=game.players[game.active],legal=legalFixerDice(p);
    selectedDieId=legal.some(d=>d.id===context.dieId)?context.dieId:legal[0]?.id;
    renderGigPicker();
  } else if(kind==='steal') {
    const rival=game.players[1-viewer];
    modal.innerHTML=modalHeading('Choose your Gigs.')+`<p class="modal-intro">Choose the exact dice to take from ${esc(rival.name)}. Select all Gigs for this steal before confirming. Their faces stay unchanged.</p><form id="steal-form"><div class="steal-grid">${rival.gigs.map(d=>`<label class="steal-option"><input type="checkbox" name="gig" value="${esc(d.id)}"><span>${die(d.value,'',d.sides)}<small>OWNED BY ${esc(game.players[d.owner]?.name ?? 'unrecorded')}</small></span></label>`).join('')}</div><div class="modal-buttons"><button type="button" class="outline-button" data-action="close-modal">Cancel</button><button class="primary-button" id="confirm-steal" disabled>Steal selected</button></div></form>`;
  } else if(kind==='remove'||kind==='restore') {
    const dice=kind==='remove'?game.players[viewer].gigs:game.removed;
    modal.innerHTML=modalHeading(kind==='remove'?'Remove which Gig?':'Restore which Gig?')+`<p class="modal-intro">${kind==='remove'?'Choose the exact die to remove. It remains available to restore with +.':'Restore a physical die that was previously removed. No extra dice are created.'}</p><div class="die-choice-grid">${dice.map(d=>`<button class="die-choice" data-action="${kind==='remove'?'confirm-remove':'confirm-restore'}" data-die="${esc(d.id)}">${die(d.value,'',d.sides)}<small>P${d.owner+1} · D${d.sides}</small></button>`).join('')}</div>`;
  } else if(kind==='edit-gig') {
    const player=context.player??viewer,d=game.players[player].gigs.find(d=>d.id===context.dieId);if(!d)return;
    modalContext.startValue=d.value;
    modal.innerHTML=modalHeading(`D${d.sides} · ${esc(game.players[player].name)}`)+`<p class="modal-intro">Adjust this friendly or rival Gig for a card effect. Tap − / + once per point, then save. Its type and owner stay the same.</p><form id="face-form"><label class="face-label" for="gig-face">FACE / 1–${d.sides}</label><div class="face-stepper"><button type="button" data-action="decrease-face" aria-label="Decrease Gig value">−</button><input id="gig-face" type="number" inputmode="numeric" min="1" max="${d.sides}" value="${d.value}" required aria-describedby="face-preview"><button type="button" data-action="increase-face" aria-label="Increase Gig value">+</button></div><p id="face-preview" class="face-preview" aria-live="polite"></p><p class="form-note">Stay within the adjustment allowed by your card. Closing without saving cancels the change.</p><div class="modal-buttons"><button type="button" class="outline-button" data-action="reroll-gig">Reroll D${d.sides}</button><button class="primary-button" id="save-face">Save face</button></div></form><div class="modal-buttons">${tableView?'<button class="text-button" data-action="rotate-editor">Rotate editor ↻</button>':''}<button class="outline-button" data-action="return-fixer">Return to Fixer</button><button class="outline-button" data-action="confirm-remove" data-die="${esc(d.id)}">Remove Gig</button></div>`;
    updateFacePreview();
  } else if(kind==='table-roll') {
    modal.innerHTML=modalHeading('Choose a free roll.')+`<p class="modal-intro">Free rolls never move dice or change Gigs. D20-last applies to taking a Gig from Fixer, not these free rolls.</p><div class="die-choice-grid">${DIE_TYPES.map(sides=>`<button class="die-choice" data-action="free-roll-type" data-sides="${sides}">${diceIcon}<strong>Roll D${sides}</strong></button>`).join('')}</div>`;
  } else if(kind==='new-game'||kind==='settings') {
    const fresh=kind==='new-game';
    modal.innerHTML=`<form id="match-form">${modalHeading(fresh?'A new gig awaits.':'Match settings.')}<p class="modal-intro">${fresh?'Each player starts with one D4, D6, D8, D10, D12 and D20 in Fixer. Choose any die each turn; D20 must be last.':'Update names or correct the physical dice to match the table.'}</p><div class="form-row">${game.players.map((p,i)=>`<div class="form-field"><label for="name-${i}">PLAYER 0${i+1}</label><input id="name-${i}" name="name-${i}" value="${esc(p.name)}" maxlength="24" required></div>`).join('')}</div>${fresh?`<div class="form-field"><label for="first-player">WHO GOES FIRST?</label><select id="first-player" name="first"><option value="0" ${game.first===0?'selected':''}>Player 01</option><option value="1" ${game.first===1?'selected':''}>Player 02</option></select></div>`:inventoryEditor()}<div class="modal-buttons"><button class="outline-button" type="button" data-action="close-modal">Cancel</button><button class="primary-button" ${!fresh&&game.result?'disabled':''}>${fresh?'Start match ↗':'Save changes'}</button></div></form>${!fresh&&!game.result?`<details class="danger-zone"><summary>Record deck-out or concession</summary><div class="form-row"><div class="form-field"><label for="losing-player">PLAYER WHO LOST</label><select id="losing-player">${game.players.map((p,i)=>`<option value="${i}">${esc(p.name)}</option>`).join('')}</select></div><div class="form-field"><label for="loss-reason">REASON</label><select id="loss-reason"><option value="concede">Conceded</option><option value="deck-out">Deck-out</option></select></div></div><button class="outline-button" data-action="record-loss">Confirm match result</button></details>`:''}`;
  } else if(kind==='install') {
    const help=installHelp();
    modal.innerHTML=modalHeading('Install Gig Tracker.')+`<p class="modal-intro">Add Gig Tracker to your home screen for quick access and a full-screen app. Free, with no account needed.</p><h3 class="install-platform">${esc(help.title)}</h3><ol class="install-steps">${help.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><p class="form-note">${esc(help.note)}</p><p class="form-note">Open the installed app online once to prepare it for offline play. Match saves are local; your browser and installed app may keep separate matches.</p><div class="modal-buttons"><button type="button" class="primary-button" data-action="close-modal">Got it</button></div>`;
  } else if(kind==='rules') {
    modal.innerHTML=modalHeading('Know the rules.')+`<div class="rules-card"><h3>01 / Six different dice</h3><p>Each player owns one D4, D6, D8, D10, D12 and D20. Choose any die remaining in Fixer each turn, except <em>D20 must be last</em>. Roll digitally or record a physical face.</p></div><div class="rules-card"><h3>02 / Steal the exact Gig</h3><p>Choose any rival Gig regardless of its value. Its type, face and original owner are preserved. For multiple Gigs, select all before confirming. Tap a friendly Gig to adjust its face for card effects.</p></div><div class="rules-card"><h3>03 / Regulation</h3><p>Start your turn with <em>7+ Gigs</em> to win, before rolling a new die. Each physical die is one Gig; Street Cred is the sum of their faces.</p></div><div class="rules-card overtime-rule"><h3>04 / Overtime</h3><p>Overtime begins at the end of the second consecutive turn whose player began with an empty Fixer, normally after both seventh turns. Seven Gigs then wins immediately, including Gigs already held when overtime starts.</p></div><p class="rules-extras">+ rolls a new Gig or restores a removed die. − lets you choose a die to remove. Fixer returns and physical setup corrections are available for card effects. Resolve card-specific alternate victories at the table.</p><a class="rules-link" href="${RULES_URL}" target="_blank" rel="noopener noreferrer">Official rules · §§6, 7.2, 8.6.5, 11.5 ↗</a>`;
  }
  if (kind === 'settings') { modal.insertAdjacentHTML('beforeend', soundSettings()); renderSoundControls(); }
  if(!modal.open)modal.showModal();
}
function updateFacePreview() {
  const input=$('gig-face');if(!input)return;
  const player=modalContext.player??dialogViewer,die=game.players[player].gigs.find(d=>d.id===modalContext.dieId);
  if(!die)return;
  const value=input.valueAsNumber,valid=Number.isInteger(value)&&value>=1&&value<=die.sides;
  document.querySelector('[data-action="decrease-face"]').disabled=!valid||value<=1;
  document.querySelector('[data-action="increase-face"]').disabled=!valid||value>=die.sides;
  $('save-face').disabled=!valid;
  if(!valid){$('face-preview').textContent=`Choose a whole number from 1 to ${die.sides}.`;return;}
  const delta=value-modalContext.startValue;
  $('face-preview').textContent=`${delta===0?'No change':`${delta>0?'+':''}${delta} from ${modalContext.startValue}`} · Street Cred ${streetCred(game.players[player])} → ${streetCred(game.players[player])+delta}`;
}
function renderGigPicker() {
  const p=game.players[game.active],legal=legalFixerDice(p),selected=p.fixer.find(d=>d.id===selectedDieId);
  $('modal').innerHTML=modalHeading(modalContext.endAfter?'Before you pass…':'Choose your Gig.')+`<p class="modal-intro">Pick any remaining Fixer die. D20 unlocks only when it is the last die left.</p><div class="die-choice-grid">${p.fixer.map(d=>{const allowed=legal.some(item=>item.id===d.id);return `<button class="die-choice ${d.id===selectedDieId?'selected':''}" data-action="select-fixer" data-die="${esc(d.id)}" aria-pressed="${d.id===selectedDieId}" ${!allowed?'disabled':''}><strong>D${d.sides}</strong><small>${allowed?'AVAILABLE':'D20 LAST · LOCKED'}</small></button>`;}).join('')}</div>${selected?`<button class="primary-button full-button" data-action="roll-selected">Roll D${selected.sides} & ${modalContext.endAfter?'end turn':'add Gig'}</button><form id="physical-form"><div class="form-field"><label for="physical-face">ALREADY ROLLED D${selected.sides}? RECORD ITS FACE / 1–${selected.sides}</label><input id="physical-face" type="number" min="1" max="${selected.sides}" value="1" required></div><button class="outline-button full-button">Record physical D${selected.sides}${modalContext.endAfter?' & end turn':''}</button></form>`:''}<div class="modal-buttons"><button class="outline-button" data-action="close-modal">Go back</button>${modalContext.endAfter?'<button class="outline-button" data-action="skip-and-end">End without a Gig</button>':''}</div>`;
}
function finishRoll(value, animate = false) {
  const player=game.active, selected=game.players[player].fixer.find(d=>d.id===selectedDieId), name=game.players[player].name, endAfter=modalContext.endAfter;
  const action={type:'roll-in',dieId:selectedDieId,value};
  let next=transition(game,action);
  if(next===game){notify('That die is unavailable or its face is invalid.');return;}
  if(modalContext.endAfter)next=transition(next,{type:'end-turn'});
  $('modal').close();commit(next,action,animate||value===selected.sides);
  rollReveal.show({ sides:selected.sides, values:[value], title:animate?'New Gig rolled':'Gig recorded', subtitle:name, note:`D${selected.sides} added · Street Cred ${streetCred(game.players[player])}${endAfter?' · Turn passed':''}`, player, table:tableView, animate, sound:animate?'roll':null });
}
function rerollGig() {
  const player=modalContext.player??dialogViewer, d=game.players[player].gigs.find(d=>d.id===modalContext.dieId);
  if(!d)return;
  const value=randomDie(d.sides), action={type:'set-value',player,dieId:d.id,value}, next=transition(game,action), viewer=dialogViewer;
  if(next===game){notify('That die is unavailable.');return;}
  $('modal').close();commit(next,action,true);
  rollReveal.show({ sides:d.sides, values:[value], title:'Gig reroll', subtitle:game.players[player].name, note:`Face ${d.value} → ${value} · Street Cred ${streetCred(game.players[player])}`, player:viewer, table:tableView });
}
function applyAndClose(action) { const next=transition(game,action);if(next===game){notify('Check the selected die and its face.');return;} $('modal').close();commit(next,action); }
function addGig(player) {
  if(player===game.active&&!game.rolled&&legalFixerDice(game.players[player]).length)showModal('roll-in',player);
  else if(game.removed.length)showModal('restore',player);
  else notify('No removed dice to restore. Roll new Gigs from Fixer on your turn.');
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');if(!button||button.disabled)return;
  if(rollReveal.isOpen)return;
  const action=button.dataset.action,viewer=Number(button.closest('.player-card')?.dataset.player??game.active);
  if(action==='toggle-sound'){const settings=sound.settings;sound.configure({muted:!settings.muted&&settings.volume>0,volume:settings.volume||0.45});renderSoundControls();return;}
  if(action==='preview-sound'){sound.play(button.dataset.sound);return;}
  if(action==='dismiss-saved-dice'){
    if(!game.needsDiceReview)return;
    const next=createGame(game.players.map(p=>p.name),game.first);
    quickResults=[];tableRolls.fill(null);$('modal').close();commit(next);
    notify('Started fresh. Undo restores your saved match.');
    document.querySelector('.reserve-roll:not(:disabled)')?.focus({preventScroll:true});return;
  }
  if(action==='toggle-table'){if(!tableViewport.matches)return;preferTableView=!tableView;try{localStorage.setItem(VIEW_STORAGE,String(preferTableView));}catch{}applyView();renderReview();sound.play('vs');if(sound.settings.effects)showVsEffect();return;}
  if(['rules','settings','new-game'].includes(action)){showModal(action,viewer);return;}
  if(action==='close-modal'){$('modal').close();return;}
  if(action==='undo'){if(history.length){game=history.pop();save();render();notify('Last match action undone.');}return;}
  if(action==='table-roll'){showModal('table-roll',viewer);return;}
  if(action==='free-roll-type'){const sides=Number(button.dataset.sides), player=dialogViewer, value=randomDie(sides);tableRolls[player]={sides,value};$('modal').close();render();rollReveal.show({sides,values:[value],title:'Free roll',subtitle:game.players[player].name,note:'Free roll · Gig count unchanged.',player,table:tableView});return;}
  if(action==='roll-in'){showModal('roll-in',game.active);return;}
  if(action==='add'){addGig(viewer);return;}
  if(action==='remove'||action==='steal'){if(action==='steal'&&!canSteal(game))return;showModal(action,viewer);return;}
  if(action==='edit-gig'){showModal('edit-gig',tableView?game.active:viewer,{dieId:button.dataset.die,player:viewer});return;}
  if(action==='decrease-face'||action==='increase-face'){
    const input=$('gig-face'),value=input.valueAsNumber;
    if(Number.isInteger(value))input.value=String(Math.max(1,Math.min(Number(input.max),value+(action==='increase-face'?1:-1))));
    updateFacePreview();return;
  }
  if(action==='rotate-editor'){dialogViewer=1-dialogViewer;applyView();return;}
  if(action==='select-fixer'){selectedDieId=button.dataset.die;renderGigPicker();return;}
  if(action==='roll-selected'){const d=game.players[game.active].fixer.find(d=>d.id===selectedDieId);if(d)finishRoll(randomDie(d.sides),true);return;}
  if(action==='confirm-remove'||action==='confirm-restore'){applyAndClose({type:action==='confirm-remove'?'remove':'restore',player:modalContext.player??dialogViewer,dieId:button.dataset.die});return;}
  if(action==='return-fixer'){applyAndClose({type:'return-fixer',player:modalContext.player??dialogViewer,dieId:modalContext.dieId});return;}
  if(action==='reroll-gig'){rerollGig();return;}
  if(action==='end-turn'){
    if(button.dataset.player!==undefined&&Number(button.dataset.player)!==game.active)return;
    if(!game.rolled&&game.players[game.active].fixer.length)showModal('roll-in',game.active,{endAfter:true});else dispatch({type:'end-turn'});return;
  }
  if(action==='skip-and-end'){$('modal').close();dispatch({type:'end-turn'});return;}
  if(action==='less-dice'||action==='more-dice'){diceQuantity=Math.min(6,Math.max(1,diceQuantity+(action==='more-dice'?1:-1)));renderRoller();return;}
  if(action==='quick-roll'){quickRoll();return;}
  if(action==='record-loss'){$('modal').close();dispatch({type:'manual-result',player:1-Number($('losing-player').value),reason:$('loss-reason').value});return;}
  if(action==='export'){
    const outcome=game.result?game.result.winners.length===2?'Draw':`${game.players[game.result.winners[0]].name} wins: ${game.result.reason}`:'In progress';
    const text=`GIG TRACKER / MATCH LOG\n${game.players.map(p=>`${p.name}: ${p.gigs.map(d=>`D${d.sides??'?'}=${d.value} [P${d.owner+1}]`).join(', ')||'no Gigs'}; Fixer: ${p.fixer.map(d=>'D'+(d.sides??'?')).join(', ')}; ${p.turns} completed turns`).join('\n')}\n${outcome}\n\n${[...game.log].reverse().map(e=>`[T${e.turn}] ${e.text}`).join('\n')}\n\n${RULES_URL}`;
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='gig-tracker-match.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='sound-enabled'){sound.configure({muted:!event.target.checked});renderSoundControls();}
  if(event.target.id==='effects-enabled'){sound.configure({effects:event.target.checked});if(!sound.settings.effects){clearEffects();rollReveal.finish();}renderSoundControls();}
  if(event.target.id==='quick-type'){quickSides=Number(event.target.value);renderRoller();}
  if(event.target.matches('#steal-form input[name="gig"]'))$('confirm-steal').disabled=!document.querySelector('#steal-form input:checked');
});
document.addEventListener('input',event=>{
  if(event.target.id==='gig-face')updateFacePreview();
  if(event.target.id==='sound-volume'){sound.configure({volume:Number(event.target.value)/100});renderSoundControls();}
});
document.addEventListener('submit',event=>{
  const form=event.target;event.preventDefault();
  if(form.id==='physical-form'){finishRoll(Number($('physical-face').value));return;}
  if(form.id==='face-form'){applyAndClose({type:'set-value',player:modalContext.player??dialogViewer,dieId:modalContext.dieId,value:Number($('gig-face').value)});return;}
  if(form.id==='steal-form'){applyAndClose({type:'steal',player:dialogViewer,dieIds:new FormData(form).getAll('gig')});return;}
  if(form.id==='match-form'){
    const data=new FormData(form),names=[data.get('name-0'),data.get('name-1')];
    if(modalKind==='new-game'){
      $('modal').close();quickResults=[];tableRolls.fill(null);
      commit(createGame(names,Number(data.get('first'))));return;
    }
    const inventory=allDice().map(d=>({id:d.id,zone:data.get('zone-'+d.id),value:Number(data.get('face-'+d.id))}));
    applyAndClose({type:'settings',names,inventory});
  }
});
$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const r=$('modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('modal').close();}});
window.addEventListener('storage',event=>{
  if(event.key===FEEDBACK_STORAGE){sound.sync(event.newValue);if(!sound.settings.effects){clearEffects();rollReveal.finish();}renderSoundControls();return;}
  if(event.key!==STORAGE||!event.newValue)return;
  try{const saved=JSON.parse(event.newValue),next=migrateGame(saved.game);if(next){game=next;history=Array.isArray(saved.history)?saved.history.map(migrateGame).filter(Boolean).slice(-100):[];$('modal').close();render();notify('Match updated from another tab.');}}catch{}
});
// Opening or resuming a match never opens a dialog. The active card prompts
// for its setup roll; the picker opens only in response to a player action.
save();render();
setupInstall({ promotion: $('install-promotion'), button: $('install-app-button'), onHelp: () => showModal('install'), onInstalled: () => { if(modalKind==='install')$('modal').close(); }, notify });
sound.preload();
document.addEventListener('visibilitychange',()=>{if(document.hidden){sound.stop();clearEffects();rollReveal.close();}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
