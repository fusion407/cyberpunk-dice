import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGame, transition } from '../dist/game.js';
import { FEEDBACK_STORAGE, SOUND_FILES, feedbackForAction, createSoundPlayer } from '../dist/feedback.js';

function twoGigs() {
  let g = transition(createGame(), { type: 'roll-in', dieId: '0-4', value: 2 });
  g = transition(g, { type: 'end-turn' });
  return transition(g, { type: 'roll-in', dieId: '1-6', value: 3 });
}

test('both steal variants hit the player losing the selected Gigs, for either thief', () => {
  for (const player of [0, 1]) {
    const g = twoGigs(), action = { type: 'steal', player, dieIds: g.players[1 - player].gigs.map(d => d.id) };
    const next = transition(g, action);
    assert.deepEqual(feedbackForAction(g, next, action, () => 0), { player: 1 - player, effect: 'shock' });
    assert.deepEqual(feedbackForAction(g, next, action, () => 0.99), { player: 1 - player, effect: 'slash' });
  }
});

test('acquisition targets the receiving player even when roll-in also ends the turn', () => {
  const g = createGame(), action = { type: 'roll-in', dieId: '0-4', value: 1 };
  const next = transition(transition(g, action), { type: 'end-turn' });
  assert.equal(next.active, 1);
  assert.deepEqual(feedbackForAction(g, next, action, () => 0), { player: 0, effect: 'quickhack' });
  assert.deepEqual(feedbackForAction(g, next, action, () => 1), { player: 0, effect: 'braindance' });
  const removed = transition(next, { type: 'remove', player: 0, dieId: '0-4' });
  const restore = { type: 'restore', player: 1, dieId: '0-4' };
  assert.deepEqual(feedbackForAction(removed, transition(removed, restore), restore, () => 0), { player: 1, effect: 'quickhack' });
});

test('eddies requires a real saved face change; rejected and unrelated actions stay quiet', () => {
  const g = twoGigs(), same = { type: 'set-value', player: 0, dieId: '0-4', value: 2 };
  assert.equal(feedbackForAction(g, transition(g, same), same), null);
  const changed = { ...same, value: 4 };
  assert.deepEqual(feedbackForAction(g, transition(g, changed), changed), { player: 0, effect: 'eddies' });
  for (const action of [{ ...same, value: 99 }, { type: 'steal', player: 0, dieIds: ['missing'] }, { type: 'end-turn' }, { type: 'settings', names: ['A', 'B'] }]) {
    assert.equal(feedbackForAction(g, transition(g, action), action), null);
  }
  assert.equal(feedbackForAction(g, structuredClone(g), null), null);
});

function audioHarness(saved, options = {}) {
  const clips = [], writes = [];
  const player = createSoundPlayer({
    storage: { getItem: () => saved, setItem: (key, value) => writes.push([key, JSON.parse(value)]) },
    isHidden: () => false,
    createAudio: () => {
      const clip = { src: '', volume: 1, currentTime: 0, playing: false, plays: 0, load() {}, pause() { this.playing = false; }, play() { this.playing = true; this.plays++; return Promise.resolve(); } };
      clips.push(clip); return clip;
    }, ...options
  });
  return { player, clips, writes };
}

test('muting stops current audio immediately, persists separately, and survives reload', () => {
  const { player, clips, writes } = audioHarness();
  player.play('quickhack');
  assert.equal(clips.filter(c => c.playing).length, 1);
  player.configure({ muted: true, volume: 0.2, effects: false });
  assert.ok(clips.every(c => !c.playing && c.volume === 0.2));
  player.play('slash');
  assert.equal(clips.reduce((sum, c) => sum + c.plays, 0), 1);
  assert.equal(writes[0][0], FEEDBACK_STORAGE);
  const reloaded = audioHarness(JSON.stringify(writes[0][1]));
  assert.deepEqual(reloaded.player.settings, { muted: true, volume: 0.2, effects: false });
});

test('new cues stop earlier clips; zero volume, hidden pages, and unknown cues do not play', () => {
  const { player, clips } = audioHarness();
  player.play('quickhack'); player.play('eddies');
  assert.equal(clips.filter(c => c.playing).length, 1);
  assert.ok(clips.find(c => c.playing).src.endsWith('/eddies.wav'));
  player.configure({ volume: 0 }); player.play('slash'); player.play('unknown');
  assert.ok(clips.every(c => !c.playing));
  const hidden = audioHarness(null, { isHidden: () => true }); hidden.player.play('shock');
  assert.equal(hidden.clips.length, 0);
});

test('unavailable storage/audio and rejected autoplay never throw or reject into the game', async () => {
  const { player } = audioHarness('{bad json', {
    storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } },
    createAudio: () => ({ load() {}, pause() {}, play: () => Promise.reject(new Error('NotAllowedError')) })
  });
  assert.doesNotThrow(() => { player.play('shock'); player.configure({ volume: 9 }); });
  assert.equal(player.settings.volume, 1);
  await new Promise(resolve => setImmediate(resolve));
  assert.doesNotThrow(() => audioHarness(null, { createAudio() { throw new Error('unsupported'); } }).player.play('slash'));
});

test('cross-tab preferences update sound without writing back or replaying audio', () => {
  const { player, clips, writes } = audioHarness(); player.play('shock');
  player.sync(JSON.stringify({ muted: true, volume: 0.3, effects: false }));
  assert.ok(clips.every(c => !c.playing));
  assert.equal(writes.length, 0);
  assert.equal(player.settings.effects, false);
  player.sync('bad json'); assert.equal(player.settings.muted, true);
});

test('downloaded sources and playable WAVs match their recorded hashes and are valid audio', async () => {
  const audioRoot = new URL('../dist/audio/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('sources.json', audioRoot), 'utf8'));
  assert.equal(manifest.sounds.length, Object.keys(SOUND_FILES).length);
  for (const sound of manifest.sounds) {
    for (const variant of ['original', 'playback']) {
      const file = await readFile(new URL(sound[variant].file, audioRoot));
      assert.equal(createHash('sha256').update(file).digest('hex'), sound[variant].sha256);
      if (variant === 'original') assert.equal(file.toString('ascii', 0, 4), 'OggS');
      else {
        assert.equal(file.toString('ascii', 0, 4), 'RIFF');
        assert.equal(file.toString('ascii', 8, 12), 'WAVE');
        assert.equal(file.readUInt32LE(24), 24000);
        assert.equal(file.readUInt32LE(40) + 44, file.length);
        assert.ok(file.length > 1000);
      }
    }
  }
});
