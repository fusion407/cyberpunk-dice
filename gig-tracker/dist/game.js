// A Gig is a die, independent of the number on its face.
export const TARGET = 7;
export const LIMIT = 24;
export const RULES_URL = 'https://cyberpunktcg.com/comprehensive-rules';
export function createGame(names = ['Player One', 'Player Two'], first = 0) {
  return { version: 1, players: names.map((name) => ({ name: name.trim().slice(0, 24) || 'Player', gigs: [], fixer: 6, turns: 0 })), active: first, first, turn: 1, emptyStarts: 0, overtime: false, rolled: false, result: null, log: [{ text: `${names[first]} starts the match.`, type: 'turn', turn: 1 }] };
}
export function rollDie(random = Math.random) { return Math.floor(random() * 6) + 1; }
function log(game, text, type = 'gig') { game.log.unshift({ text, type, turn: game.turn }); game.log = game.log.slice(0, 100); }
function declare(game, winners, reason) { game.result = { winners, reason }; log(game, winners.length > 1 ? 'Draw: both players met the win condition simultaneously.' : `${game.players[winners[0]].name} wins! ${reason}`, 'win'); }
function checkOvertime(game, entry = false) {
  const winners = game.players.flatMap((p, i) => p.gigs.length >= TARGET ? [i] : []);
  if (winners.length) declare(game, winners, entry ? 'Held 7+ Gigs when overtime began.' : 'Reached 7 Gigs during overtime.');
}
export function transition(previous, action) {
  if (previous.result) return previous;
  const game = structuredClone(previous);
  const p = game.players[action.player ?? game.active];
  const rival = game.players[1 - (action.player ?? game.active)];
  switch (action.type) {
    case 'add':
      if (!p || p.gigs.length >= LIMIT) return previous;
      p.gigs.push(action.value ?? rollDie()); log(game, `${p.name} gained a Gig. ${p.gigs.length} in play.`); break;
    case 'remove':
      if (!p?.gigs.length) return previous;
      p.gigs.pop(); log(game, `${p.name} lost a Gig. ${p.gigs.length} in play.`); break;
    case 'steal':
      if (!p || !rival.gigs.length || p.gigs.length >= LIMIT) return previous;
      p.gigs.push(rival.gigs.pop()); log(game, `${p.name} stole 1 Gig from ${rival.name}.`); break;
    case 'roll-in': {
      const current = game.players[game.active];
      if (game.rolled || current.fixer < 1 || current.gigs.length >= LIMIT) return previous;
      current.fixer--; const value = action.value ?? rollDie(); current.gigs.push(value); game.rolled = true;
      log(game, `${current.name} rolled in a ${value}. ${current.gigs.length} Gigs in play.`, 'roll'); break;
    }
    case 'end-turn': {
      const current = game.players[game.active]; current.turns++;
      log(game, `${current.name} ended turn ${current.turns}.`, 'turn');
      // Overtime starts at the END of the second consecutive empty-Fixer start.
      // Check existing totals BEFORE beginning the next player's turn.
      if (!game.overtime && game.emptyStarts >= 2) {
        game.overtime = true; log(game, 'Overtime began. Seven Gigs now wins immediately.', 'overtime'); checkOvertime(game, true);
        if (game.result) break;
      }
      game.active = 1 - game.active; game.turn++; game.rolled = false;
      const next = game.players[game.active];
      game.emptyStarts = next.fixer === 0 ? game.emptyStarts + 1 : 0;
      log(game, `${next.name} began turn ${next.turns + 1}.`, 'turn');
      if (!game.overtime && next.gigs.length >= TARGET) declare(game, [game.active], 'Began their turn with 7+ Gigs.');
      break;
    }
    case 'settings':
      for (let i = 0; i < 2; i++) { game.players[i].name = String(action.names[i]).trim().slice(0, 24) || `Player ${i + 1}`; game.players[i].fixer = Math.min(LIMIT, Math.max(0, Math.trunc(Number(action.fixers[i]) || 0))); }
      log(game, 'Player names / Fixer reserves updated.', 'edit'); break;
    case 'manual-result':
      if (![0, 1].includes(action.player)) return previous;
      declare(game, [action.player], action.reason === 'deck-out' ? 'Their rival was required to draw from an empty deck.' : 'Their rival conceded.'); break;
    default: return previous;
  }
  if (game.overtime && !game.result) checkOvertime(game);
  return game;
}
export function isValidGame(game) {
  if (!game || game.version !== 1 || !Array.isArray(game.players) || game.players.length !== 2) return false;
  if (!game.players.every((p) => p && typeof p.name === 'string' && p.name.length <= 24 && Array.isArray(p.gigs) && p.gigs.length <= LIMIT && p.gigs.every((v) => Number.isInteger(v) && v >= 1 && v <= 6) && Number.isInteger(p.fixer) && p.fixer >= 0 && p.fixer <= LIMIT && Number.isInteger(p.turns) && p.turns >= 0)) return false;
  if (![0, 1].includes(game.active) || ![0, 1].includes(game.first) || !Number.isInteger(game.turn) || game.turn < 1 || !Number.isInteger(game.emptyStarts) || game.emptyStarts < 0 || typeof game.rolled !== 'boolean' || typeof game.overtime !== 'boolean') return false;
  if (game.result !== null && (!game.result || !Array.isArray(game.result.winners) || game.result.winners.length < 1 || game.result.winners.length > 2 || !game.result.winners.every((i) => [0, 1].includes(i)) || typeof game.result.reason !== 'string')) return false;
  return Array.isArray(game.log) && game.log.length <= 100 && game.log.every((entry) => entry && typeof entry.text === 'string' && typeof entry.type === 'string' && Number.isInteger(entry.turn));
}
