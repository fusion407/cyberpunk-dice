import { createGame, transition, isValidGame, LIMIT, RULES_URL } from './game.js';

const $ = (id) => document.getElementById(id);
const esc = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const STORAGE = 'gig-tracker:match:v1';
let game = createGame();
let history = [];
let storageAvailable = true;
let diceQuantity = 1;
let quickResults = [];
let rolling = false;
let toastTimer;
let modalKind = null;
const mobileViewport = window.matchMedia('(max-width: 600px)');
const VIEW_STORAGE = 'gig-tracker:table-view:v1';
let preferTableView = false;
let tableView = false;
let standardScrollY = 0;
let dialogViewer = 0;
const tableRolls = [null, null];

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE));
  if (saved && isValidGame(saved.game)) { game = saved.game; history = Array.isArray(saved.history) ? saved.history.filter(isValidGame).slice(-100) : []; }
} catch { /* A corrupt or unavailable save must not prevent play. */ }
try { preferTableView = localStorage.getItem(VIEW_STORAGE) === 'true'; } catch { /* View switching also works without storage. */ }

function applyView() {
  const nextView = mobileViewport.matches && preferTableView;
  if (nextView && !tableView) standardScrollY = window.scrollY;
  const changed = nextView !== tableView;
  tableView = nextView;
  document.body.classList.toggle('table-view', tableView);
  $('modal').classList.toggle('table-top-dialog', tableView && dialogViewer === 1);
  const toggle = $('view-toggle');
  if (toggle) {
    const label = tableView ? 'Return to standard view' : 'Switch to face-to-face table view';
    toggle.setAttribute('aria-pressed', String(tableView));
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }
  if (changed) window.scrollTo(0, tableView ? 0 : standardScrollY);
}
mobileViewport.addEventListener('change', applyView);

// Rejection sampling avoids modulo bias while using the device's secure RNG.
function randomDie() {
  if (!globalThis.crypto?.getRandomValues) return Math.floor(Math.random() * 6) + 1;
  const bytes = new Uint8Array(1);
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= 252);
  return bytes[0] % 6 + 1;
}

function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify({ game, history })); storageAvailable = true; }
  catch { storageAvailable = false; }
}
function notify(message) {
  $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
}
function commit(next) {
  if (next === game) return;
  const hadWinner = !!game.result;
  const focused = document.activeElement?.closest('button[data-action]');
  const focusAction = focused?.dataset.action;
  const focusPlayer = focused?.dataset.player;
  history.push(structuredClone(game)); history = history.slice(-100); game = next; save(); render();
  if (game.result && !hadWinner) {
    const announcement = tableView ? document.querySelector(`.player-card[data-player="${game.result.winners[0]}"] .table-result`) : $('match-announcement');
    announcement.setAttribute('tabindex', '-1'); announcement.focus({ preventScroll: tableView });
    navigator.vibrate?.([60, 50, 100]);
  } else if (focusAction && ['add', 'remove', 'steal'].includes(focusAction)) {
    document.querySelector(`button[data-action="${focusAction}"][data-player="${focusPlayer}"]:not(:disabled)`)?.focus({ preventScroll: true });
  }
}
function dispatch(action) {
  if (action.type === 'add' || action.type === 'roll-in') action.value ??= randomDie();
  commit(transition(game, action));
}

const pipPositions = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
function die(value, extra = '') {
  return `<span class="die ${extra}" role="img" aria-label="Die showing ${value}">${pipPositions[value].map((pos) => `<span style="grid-area:${Math.ceil(pos / 3)}/${(pos - 1) % 3 + 1}"></span>`).join('')}</span>`;
}
const arrowIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14m-4-4 4 4-4 4M19 16H5m4-4-4 4 4 4"/></svg>';
const diceIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01M12 12h.01M16 16h.01" stroke-width="3"/></svg>';
const settingsIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6m8 4v6"/></svg>';

function playerCard(p, index) {
  const current = index === game.active && !game.result;
  const won = game.result?.winners.includes(index);
  const count = p.gigs.length;
  const status = game.result ? (won ? (game.result.winners.length === 2 ? 'DRAW' : 'WINNER') : 'MATCH OVER') : current ? '● YOUR TURN' : 'STANDING BY';
  const rack = p.gigs.slice(0, 7).map((v) => die(v)).join('') + Array.from({ length: Math.max(0, 7 - count) }, () => '<span class="die ghost" aria-hidden="true"></span>').join('') + (count > 7 ? `<span class="gig-overflow">+${count - 7}</span>` : '');
  const rollDisabled = game.rolled || !p.fixer || count >= LIMIT || game.result;
  const playerTurn = p.turns + (current ? 1 : 0);
  const resultText = game.result ? game.result.winners.length === 2 ? 'MATCH DRAWN' : won ? 'YOU WIN' : 'RIVAL WINS' : count >= 7 ? 'HOLD UNTIL YOUR NEXT TURN TO WIN' : '';
  return `<article class="player-card ${index === 1 ? 'player-two' : ''} ${current ? 'active' : ''} ${won ? 'winner' : ''}" data-player="${index}" aria-label="${esc(p.name)}${current ? ', active player' : ''}">
    <div class="table-only table-turn-track" aria-label="${esc(p.name)} turn progress"><span>TURN <b>${String(Math.max(1, playerTurn)).padStart(2, '0')}</b><small>${game.overtime ? 'OVERTIME' : '/ 07'}</small></span><div class="table-turn-markers">${Array.from({length:7}, (_, i) => `<span class="table-turn-marker ${p.turns > i ? 'done' : current && p.turns === i ? 'current' : ''}" aria-label="Turn ${i + 1}: ${p.turns > i ? 'completed' : current && p.turns === i ? 'current' : 'upcoming'}">${i + 1}</span>`).join('')}</div></div>
    <div class="player-heading"><div class="player-identity"><span class="player-number">0${index + 1}</span><div><h2>${esc(p.name)}</h2><small>${index === game.first ? 'FIRST TO PLAY' : 'SECOND TO PLAY'}</small></div></div><span class="player-status">${status}</span></div>
    <div class="player-main"><div class="gig-count"><span class="count-number" aria-live="polite" aria-label="${count} Gig dice">${count}</span><div class="count-details"><strong>/ 7</strong><span>GIG DICE</span></div></div><div class="table-only table-quick-roll"><button class="table-roll-button" data-action="table-roll" data-player="${index}" aria-label="Roll a free D6 for ${esc(p.name)}"><span class="table-roll-output" aria-live="polite">${tableRolls[index] ?? diceIcon}</span><span>ROLL D6</span></button><small>FREE ROLL · NO GIG CHANGE</small></div></div>
    <div class="gig-rack" aria-label="Gig die faces">${rack}</div>
    <div class="counter-controls"><button data-action="remove" data-player="${index}" aria-label="Remove a Gig from ${esc(p.name)}" ${!count || game.result ? 'disabled' : ''}>−</button><button class="steal-button" data-action="steal" data-player="${index}" aria-label="${esc(p.name)} steals one Gig from their rival" ${!game.players[1 - index].gigs.length || count >= LIMIT || game.result ? 'disabled' : ''}>${arrowIcon}Steal 1</button><button data-action="add" data-player="${index}" aria-label="Add a Gig to ${esc(p.name)}" title="Manual Gig adjustment; use Roll in a Gig to take from Fixer" ${count >= LIMIT || game.result ? 'disabled' : ''}>+</button></div>
    <div class="pending-win">${count >= 7 && !game.overtime && !game.result ? 'HOLD UNTIL YOUR NEXT TURN TO WIN' : won ? 'NIGHT CITY IS YOURS.' : '&nbsp;'}</div>
    <div class="reserve"><span>FIXER RESERVE</span><div class="reserve-amount" aria-label="${p.fixer} dice in Fixer">${Array.from({ length: Math.min(p.fixer, 6) }, () => '<i></i>').join('')}<b>${p.fixer}</b></div>${current ? `<button class="reserve-roll" data-action="roll-in" ${rollDisabled ? 'disabled' : ''}>${diceIcon}${game.rolled ? 'GIG ROLLED IN' : !p.fixer ? 'RESERVE EMPTY' : 'ROLL IN A GIG'}</button>` : `<span class="reserve-wait">${game.result ? `${p.turns} TURNS COMPLETED` : `${p.turns} ${p.turns === 1 ? 'TURN' : 'TURNS'} COMPLETED`}</span>`}</div>
    <div class="table-only table-footer"><div class="table-result ${resultText ? 'has-result' : ''}" aria-live="polite">${resultText ? `<strong>${resultText}</strong>${game.result ? `<span>${esc(game.result.reason)}</span>` : ''}` : ''}</div><div class="table-actions"><button class="icon-button" data-action="settings" aria-label="Match settings for ${esc(p.name)}">${settingsIcon}</button><button class="table-undo" data-action="undo" aria-label="Undo last action for ${esc(p.name)}" ${!history.length ? 'disabled' : ''}>↶ Undo</button>${game.result ? '<button class="primary-button table-end-turn" data-action="new-game">New match ↗</button>' : `<button class="primary-button table-end-turn" data-action="end-turn" data-player="${index}" aria-label="End ${esc(p.name)}’s turn" ${!current ? 'disabled' : ''}>${current ? 'End turn →' : 'Waiting for rival'}</button>`}</div></div>
  </article>`;
}

function render() {
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
  $('turn-hint').textContent = game.result ? game.result.reason : game.overtime ? 'Sudden death. Seven Gigs wins immediately, for either player.' : game.rolled ? 'Gig rolled in. Play your turn, then pass to your rival.' : active.fixer ? 'Check Gigs, then roll in a die from your Fixer.' : 'Fixer empty. Play your turn, then pass to your rival.';
  $('overtime-note').textContent = game.overtime ? 'Overtime is active. Gig totals are checked after every change.' : game.emptyStarts >= 2 ? 'Overtime begins when this turn ends. Both players started with empty Fixers.' : game.emptyStarts === 1 ? 'First empty-Fixer start recorded. Waiting for the next turn’s check.' : 'Overtime normally begins after both players finish turn 7.';
  $('end-turn').disabled = !!game.result;
  $('undo').disabled = !history.length;
  $('match-announcement').innerHTML = game.result ? `<div><span class="eyebrow">${game.result.winners.length === 2 ? 'SIMULTANEOUS VICTORY' : 'VICTORY CONFIRMED'}</span><strong>${game.result.winners.length === 2 ? 'The match is a draw.' : `${esc(game.players[game.result.winners[0]].name)} wins.`}</strong><p>${esc(game.result.reason)}</p></div><button class="text-button" data-action="new-game">Play again ↗</button>` : game.overtime ? '<div><strong>Welcome to overtime.</strong><p>First to seven Gigs wins immediately. Every move counts.</p></div>' : '';
  $('log-count').textContent = `${String(game.log.length).padStart(2, '0')} ${game.log.length === 1 ? 'EVENT' : 'EVENTS'}`;
  $('match-log').innerHTML = game.log.map((entry) => `<div class="log-entry ${esc(entry.type)}"><span>T${String(entry.turn).padStart(2, '0')}</span><p>${esc(entry.text)}</p></div>`).join('');
  document.querySelector('.log-footer>span').innerHTML = `<i></i> ${storageAvailable ? 'AUTOSAVED ON THIS DEVICE' : 'STORAGE UNAVAILABLE · KEEP APP OPEN'}`;
  renderRoller();
  applyView();
}
function renderRoller() {
  $('dice-quantity').textContent = `${diceQuantity} ${diceQuantity === 1 ? 'die' : 'dice'}`;
  document.querySelector('[data-action="less-dice"]').disabled = diceQuantity === 1 || rolling;
  document.querySelector('[data-action="more-dice"]').disabled = diceQuantity === 6 || rolling;
  $('quick-roll').disabled = rolling;
  $('roll-results').innerHTML = quickResults.length ? quickResults.map((v) => die(v)).join('') : die(5, 'die-placeholder');
  $('roll-summary').innerHTML = quickResults.length ? `LAST ROLL / ${quickResults.length}D6<br>TOTAL <b>${quickResults.reduce((a, b) => a + b, 0)}</b>` : 'READY WHEN<br>YOU ARE';
}
function quickRoll() {
  if (rolling) return;
  rolling = true; quickResults = Array.from({ length: diceQuantity }, randomDie); renderRoller();
  $('roll-results').classList.add('dice-rolling');
  setTimeout(() => { rolling = false; $('roll-results').classList.remove('dice-rolling'); renderRoller(); }, 360);
}

function showModal(kind, viewer = game.active) {
  modalKind = kind;
  dialogViewer = viewer;
  const modal = $('modal');
  modal.classList.toggle('table-top-dialog', tableView && viewer === 1);
  const close = '<button class="icon-button" data-action="close-modal" type="button" aria-label="Close dialog">×</button>';
  if (kind === 'rules') {
    modal.innerHTML = `<div class="modal-heading"><h2 id="modal-title">Know the rules.</h2>${close}</div><p class="modal-intro">The timing matters as much as the number. Here’s what Gig Tracker checks for you.</p><div class="rules-card"><h3>01 / Regulation</h3><p>Start your turn with <em>7 or more Gig dice</em> to win. This is checked <em>before</em> you roll a Gig in from your Fixer. Reaching seven during a turn means holding them until your next turn.</p></div><div class="rules-card overtime-rule"><h3>02 / Overtime</h3><p>After two consecutive turns that each began with that player’s Fixer empty, overtime begins at the end of the second turn. With six starting Fixer dice, this is usually <em>after both players’ seventh turns</em>.</p><p>Then seven Gigs wins <em>immediately</em>, including Gigs already held as overtime begins. If both qualify simultaneously, it’s a draw.</p></div><div class="rules-card"><h3>03 / At the table</h3><p>Use <em>Roll in a Gig</em> once each turn to move a die from Fixer into play. Use <em>Steal 1</em> to transfer a rival’s die. The + / − buttons make manual Gig adjustments without changing Fixer. Set Fixer counts in settings if a card changes your reserves.</p></div><p class="rules-extras">A die counts as one Gig whatever its face shows. Quick rolls never change the match. Deck-out or concession can be recorded in Match settings. Card-specific alternate victories require a manual ruling.</p><a class="rules-link" href="${RULES_URL}" target="_blank" rel="noopener noreferrer">Official comprehensive rules · §1.10–1.14 ↗</a><p class="form-note">Rules checked November 7, 2026. Unofficial fan tool; not affiliated with the publisher.</p>`;
  } else if (kind === 'new-game' || kind === 'settings') {
    const fresh = kind === 'new-game';
    modal.innerHTML = `<form id="match-form"><div class="modal-heading"><h2 id="modal-title">${fresh ? 'A new gig awaits.' : 'Match settings.'}</h2>${close}</div><p class="modal-intro">${fresh ? 'Choose your players and who goes first. Each player starts with six dice in Fixer and zero Gigs in play.' : 'Update player names or correct your Fixer reserves to match the table.'}</p><div class="form-row">${game.players.map((p, i) => `<div class="form-field"><label for="name-${i}">PLAYER 0${i + 1}</label><input id="name-${i}" name="name-${i}" value="${esc(p.name)}" maxlength="24" autocomplete="off" required></div>`).join('')}</div>${fresh ? `<div class="form-field"><label for="first-player">WHO GOES FIRST?</label><select id="first-player" name="first"><option value="0" ${game.first === 0 ? 'selected' : ''}>Player 01</option><option value="1" ${game.first === 1 ? 'selected' : ''}>Player 02</option></select></div><p class="form-note">The current match is replaced. You can undo the new match if you change your mind.</p>` : `<div class="form-row">${game.players.map((p, i) => `<div class="form-field"><label for="fixer-${i}">PLAYER 0${i + 1} / FIXER DICE</label><input id="fixer-${i}" name="fixer-${i}" type="number" min="0" max="24" step="1" required value="${p.fixer}"></div>`).join('')}</div><p class="form-note">Use these counts when a card changes your reserve. A change during a turn does not change whether Fixer was empty at that turn’s start.</p>`}<div class="modal-buttons"><button class="outline-button" type="button" data-action="close-modal">Cancel</button><button class="primary-button" type="submit" ${!fresh && game.result ? 'disabled' : ''}>${fresh ? 'Start match ↗' : 'Save changes'}</button></div></form>${!fresh && !game.result ? `<details class="danger-zone"><summary>Record deck-out or concession</summary><div class="form-row"><div class="form-field"><label for="losing-player">PLAYER WHO LOST</label><select id="losing-player">${game.players.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('')}</select></div><div class="form-field"><label for="loss-reason">REASON</label><select id="loss-reason"><option value="concede">Conceded</option><option value="deck-out">Deck-out</option></select></div></div><button class="outline-button" data-action="record-loss">Confirm match result</button><p class="form-note">Deck-out applies when a player must draw from an empty deck. You can undo a recorded result.</p></details>` : ''}`;
  } else if (kind === 'skip-roll') {
    const name = esc(game.players[game.active].name);
    modal.innerHTML = `<div class="modal-heading"><h2 id="modal-title">One last check.</h2>${close}</div><p class="modal-intro">${name} still has dice in Fixer and hasn’t recorded a Gig this turn. Keeping the reserve accurate keeps overtime accurate.</p><div class="form-field"><label for="physical-face">ALREADY ROLLED AT THE TABLE? CHOOSE THE FACE.</label><select id="physical-face">${[1,2,3,4,5,6].map((v) => `<option value="${v}">${v}</option>`).join('')}</select></div><button class="primary-button" data-action="record-and-end" style="width:100%;justify-content:center">Record physical Gig & end turn</button><div class="modal-buttons"><button class="outline-button" data-action="close-modal">Go back</button><button class="outline-button" data-action="skip-and-end">End without a Gig</button></div><p class="form-note">Record adds one Gig and removes one Fixer die. Skip only if the table state calls for it; skipped rolls can delay overtime.</p>`;
  }
  if (!modal.open) modal.showModal();
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'toggle-table') {
    if (!mobileViewport.matches) return;
    preferTableView = !tableView;
    try { localStorage.setItem(VIEW_STORAGE, String(preferTableView)); } catch { /* Keep the view usable without storage. */ }
    applyView();
    return;
  }
  if (action === 'table-roll') {
    const player = Number(button.dataset.player);
    tableRolls[player] = randomDie();
    button.querySelector('.table-roll-output').textContent = tableRolls[player];
    return;
  }
  if (['add', 'remove', 'steal'].includes(action)) { dispatch({ type: action, player: Number(button.dataset.player) }); return; }
  if (action === 'roll-in') { dispatch({ type: action }); return; }
  if (action === 'end-turn') {
    if (button.dataset.player !== undefined && Number(button.dataset.player) !== game.active) return;
    const player = game.players[game.active];
    if (!game.rolled && player.fixer > 0 && player.gigs.length < LIMIT) showModal('skip-roll');
    else dispatch({ type: 'end-turn' });
    return;
  }
  if (action === 'skip-and-end' || action === 'record-and-end') {
    let next = game;
    if (action === 'record-and-end') next = transition(next, { type: 'roll-in', value: Number($('physical-face').value) });
    next = transition(next, { type: 'end-turn' }); $('modal').close(); commit(next); return;
  }
  if (action === 'undo') {
    if (history.length) { game = history.pop(); save(); render(); notify('Last match action undone.'); } return;
  }
  if (['rules', 'settings', 'new-game'].includes(action)) { showModal(action, Number(button.closest('.player-card')?.dataset.player ?? game.active)); return; }
  if (action === 'close-modal') { $('modal').close(); return; }
  if (action === 'less-dice' || action === 'more-dice') { diceQuantity = Math.min(6, Math.max(1, diceQuantity + (action === 'more-dice' ? 1 : -1))); renderRoller(); return; }
  if (action === 'quick-roll') { quickRoll(); return; }
  if (action === 'record-loss') { const loser = Number($('losing-player').value); const reason = $('loss-reason').value; $('modal').close(); dispatch({ type: 'manual-result', player: 1 - loser, reason }); return; }
  if (action === 'export') {
    const outcome = game.result ? game.result.winners.length === 2 ? 'Draw' : `${game.players[game.result.winners[0]].name} wins: ${game.result.reason}` : 'In progress';
    const text = `GIG TRACKER / MATCH LOG\n${game.players.map((p) => `${p.name}: ${p.gigs.length} Gigs, ${p.fixer} Fixer, ${p.turns} completed turns`).join('\n')}\n${outcome}\n\n${[...game.log].reverse().map((entry) => `[T${entry.turn}] ${entry.text}`).join('\n')}\n\n${RULES_URL}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'gig-tracker-match.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('Match log exported.');
  }
});
document.addEventListener('submit', (event) => {
  if (event.target.id !== 'match-form') return;
  event.preventDefault(); const data = new FormData(event.target); const names = [data.get('name-0'), data.get('name-1')];
  const next = modalKind === 'new-game' ? createGame(names, Number(data.get('first'))) : transition(game, { type: 'settings', names, fixers: [data.get('fixer-0'), data.get('fixer-1')] });
  $('modal').close(); commit(next); notify(modalKind === 'new-game' ? 'New match started. Good luck, choom.' : 'Match settings saved.');
});
$('modal').addEventListener('click', (event) => { if (event.target === $('modal')) { const box = $('modal').getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) $('modal').close(); } });
// Another tab can update the same match. Adopt it rather than overwriting it.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE || !event.newValue) return;
  try { const saved = JSON.parse(event.newValue); if (isValidGame(saved.game)) { game = saved.game; history = Array.isArray(saved.history) ? saved.history.filter(isValidGame).slice(-100) : []; render(); notify('Match updated from another tab.'); } } catch { /* Ignore malformed external state. */ }
});
save(); render();
if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => { /* Online play remains available if caching is blocked. */ });
