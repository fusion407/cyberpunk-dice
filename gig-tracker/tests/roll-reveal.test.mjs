import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRoll } from '../dist/roll-reveal.js';
import { DIE_TYPES } from '../dist/game.js';

test('dice reveals preserve every actual face and compute the correct multi-die total', () => {
  for (const sides of DIE_TYPES) {
    const values = [1, sides, 2, sides, 1, 3], snapshot = [...values];
    const reveal = summarizeRoll(sides, values);
    assert.deepEqual(reveal.values, values); assert.equal(reveal.total, 2*sides+7);
    reveal.values[0] = sides; assert.deepEqual(values, snapshot);
    assert.equal(reveal.maximum, false);
    assert.equal(summarizeRoll(sides, [sides, sides]).maximum, true);
    assert.equal(summarizeRoll(sides, [1]).total, 1);
  }
});

test('invalid faces and unsupported dice cannot appear in a reveal', () => {
  for (const [sides, values] of [[3,[1]], [6,[]], [6,[0]], [6,[7]], [4,[2.5]], [20,[NaN]], [6,Array(7).fill(1)]]) assert.throws(() => summarizeRoll(sides, values), RangeError);
});
