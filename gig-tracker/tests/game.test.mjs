import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, transition, isValidGame, rollDie } from '../dist/game.js';

const add = (game, player, count) => { for (let i = 0; i < count; i++) game = transition(game, { type: 'add', player, value: 3 }); return game; };
function playToSeventhTurn(first = 0) {
  let game = createGame(['V', 'Jackie'], first);
  for (let turn = 0; turn < 12; turn++) { game = transition(game, { type: 'roll-in', value: 2 }); game = transition(game, { type: 'end-turn' }); }
  return game;
}

test('normal victory waits until that player’s next turn, before any Gig roll', () => {
  let g = add(createGame(), 0, 7);
  assert.equal(g.result, null);
  g = transition(g, { type: 'end-turn' });
  assert.equal(g.result, null);
  g = transition(g, { type: 'end-turn' });
  assert.deepEqual(g.result.winners, [0]);
  assert.match(g.result.reason, /Began their turn/);
  assert.equal(g.rolled, false);
});
test('a seventh Gig rolled during Start Phase does not win in regulation', () => {
  let g = add(createGame(), 0, 6);
  g = transition(g, { type: 'roll-in', value: 4 });
  assert.equal(g.players[0].gigs.length, 7);
  assert.equal(g.result, null);
});
test('normal regulation can continue after seven rounds if Fixer is not empty', () => {
  let g = createGame();
  for (let i = 0; i < 20; i++) g = transition(g, { type: 'end-turn' });
  assert.equal(g.overtime, false);
  assert.equal(g.players[0].fixer, 6);
});
test('overtime starts only after the second player finishes their seventh turn', () => {
  let g = playToSeventhTurn();
  assert.equal(g.turn, 13); assert.equal(g.emptyStarts, 1); assert.equal(g.overtime, false);
  g = transition(g, { type: 'end-turn' });
  assert.equal(g.turn, 14); assert.equal(g.emptyStarts, 2); assert.equal(g.overtime, false);
  g = transition(g, { type: 'end-turn' });
  assert.equal(g.turn, 15); assert.equal(g.overtime, true); assert.equal(g.result, null);
  assert.deepEqual(g.players.map((p) => p.turns), [7, 7]);
});
test('second player holding seven when overtime starts wins before first player’s next turn', () => {
  let g = transition(playToSeventhTurn(), { type: 'end-turn' });
  g = transition(g, { type: 'steal', player: 1 });
  assert.equal(g.result, null);
  g = transition(g, { type: 'end-turn' });
  assert.equal(g.overtime, true); assert.deepEqual(g.result.winners, [1]);
  assert.match(g.result.reason, /when overtime began/);
  assert.equal(g.active, 1);
});
test('overtime checks either player immediately when a Gig changes hands', () => {
  let g = transition(transition(playToSeventhTurn(), { type: 'end-turn' }), { type: 'end-turn' });
  const total = g.players[0].gigs.length + g.players[1].gigs.length;
  g = transition(g, { type: 'steal', player: 1 });
  assert.deepEqual(g.result.winners, [1]);
  assert.equal(g.players[0].gigs.length + g.players[1].gigs.length, total);
});
test('win at first player’s seventh turn has priority over future overtime', () => {
  let g = createGame();
  for (let i = 0; i < 11; i++) { g = transition(g, { type: 'roll-in', value: 2 }); g = transition(g, { type: 'end-turn' }); }
  g = transition(g, { type: 'roll-in', value: 2 });
  g = add(g, 0, 1);
  g = transition(g, { type: 'end-turn' });
  assert.equal(g.overtime, false); assert.deepEqual(g.result.winners, [0]);
});
test('starting player can be either player without changing the overtime boundary', () => {
  let g = playToSeventhTurn(1);
  assert.equal(g.active, 1);
  g = transition(g, { type: 'end-turn' });
  g = transition(g, { type: 'steal', player: 0 });
  g = transition(g, { type: 'end-turn' });
  assert.equal(g.overtime, true); assert.deepEqual(g.result.winners, [0]);
});
test('changing a Fixer reserve preserves whether the current turn began empty', () => {
  let g = playToSeventhTurn();
  g = transition(g, { type: 'settings', names: ['V', 'Jackie'], fixers: [0, 1] });
  g = transition(g, { type: 'end-turn' });
  assert.equal(g.emptyStarts, 0); assert.equal(g.overtime, false);
  g = transition(g, { type: 'roll-in', value: 2 });
  g = transition(g, { type: 'end-turn' });
  assert.equal(g.emptyStarts, 1); assert.equal(g.overtime, false);
});
test('both qualifying simultaneously when overtime begins is a draw', () => {
  let g = transition(playToSeventhTurn(), { type: 'end-turn' });
  g = add(add(g, 0, 1), 1, 1);
  g = transition(g, { type: 'end-turn' });
  assert.deepEqual(g.result.winners, [0, 1]);
});
test('a Gig rolls from Fixer once per turn and undo snapshots are not mutated', () => {
  const original = createGame();
  const g = transition(original, { type: 'roll-in', value: 6 });
  assert.equal(original.players[0].fixer, 6); assert.equal(original.players[0].gigs.length, 0);
  assert.equal(g.players[0].fixer, 5); assert.deepEqual(g.players[0].gigs, [6]);
  assert.equal(transition(g, { type: 'roll-in' }), g);
});
test('counters cannot go below zero, steal absent dice, or exceed the safety limit', () => {
  const original = createGame();
  assert.equal(transition(original, { type: 'remove', player: 0 }), original);
  assert.equal(transition(original, { type: 'steal', player: 0 }), original);
  const full = add(original, 0, 24);
  assert.equal(transition(full, { type: 'add', player: 0 }), full);
});
test('concession and deck-out record the correct winner and freeze the match', () => {
  const g = transition(createGame(), { type: 'manual-result', player: 1, reason: 'deck-out' });
  assert.deepEqual(g.result.winners, [1]); assert.match(g.result.reason, /empty deck/);
  assert.equal(transition(g, { type: 'add', player: 0 }), g);
});
test('persisted matches validate while malformed saves are rejected', () => {
  const original = createGame(); assert.equal(isValidGame(original), true);
  assert.equal(isValidGame(null), false); assert.equal(isValidGame({}), false);
  for (const update of [{ active: 2 }, { turn: -1 }, { players: [] }, { players: [null, null] }, { result: { winners: [5], reason: 'bad' } }, { log: null }, { log: [null] }]) assert.equal(isValidGame({ ...original, ...update }), false);
  const broken = structuredClone(original); broken.players[0].gigs = [7]; assert.equal(isValidGame(broken), false);
  assert.equal(isValidGame(JSON.parse(JSON.stringify(playToSeventhTurn()))), true);
});
test('die faces span one to six', () => { assert.equal(rollDie(() => 0), 1); assert.equal(rollDie(() => .999999), 6); });
