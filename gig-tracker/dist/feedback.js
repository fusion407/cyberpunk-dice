export const FEEDBACK_STORAGE = 'gig-tracker:feedback:v1';
export const SOUND_FILES = Object.freeze({
  shock: 'short-circuit', slash: 'katana-slash', quickhack: 'quickhack', braindance: 'braindance', eddies: 'eddies', vs: 'vs-button'
});
const defaults = { muted: false, volume: 0.45, effects: true };

function preferences(value = {}) {
  return {
    muted: typeof value?.muted === 'boolean' ? value.muted : defaults.muted,
    volume: Number.isFinite(value?.volume) ? Math.max(0, Math.min(1, value.volume)) : defaults.volume,
    effects: typeof value?.effects === 'boolean' ? value.effects : defaults.effects
  };
}

// Only a successful, local match action can produce feedback. Restores gain a
// Gig too; undo, load, settings corrections and free rolls are intentionally quiet.
export function feedbackForAction(previous, next, action, random = Math.random) {
  if (!action || next === previous) return null;
  const player = action.player ?? previous.active;
  if (action.type === 'steal') {
    return { player: 1 - player, effect: random() < 0.5 ? 'shock' : 'slash' };
  }
  if (action.type === 'roll-in' || action.type === 'restore') {
    return { player: action.type === 'roll-in' ? previous.active : player, effect: random() < 0.5 ? 'quickhack' : 'braindance' };
  }
  if (action.type === 'set-value') {
    const before = previous.players[player].gigs.find(d => d.id === action.dieId);
    const after = next.players[player].gigs.find(d => d.id === action.dieId);
    if (before && after && before.value !== after.value) return { player, effect: 'eddies' };
  }
  return null;
}

export function createSoundPlayer({ storage, createAudio = () => new Audio(), isHidden = () => document.hidden } = {}) {
  let settings = { ...defaults };
  const sounds = new Map();
  try { settings = preferences(JSON.parse(storage?.getItem(FEEDBACK_STORAGE))); } catch { /* Preferences must never block the game. */ }

  function stop() {
    for (const audio of sounds.values()) {
      audio.pause();
      try { audio.currentTime = 0; } catch { /* A clip may not have loaded yet. */ }
    }
  }
  function configure(patch, persist = true) {
    settings = preferences({ ...settings, ...patch });
    for (const audio of sounds.values()) audio.volume = settings.volume;
    if (settings.muted || settings.volume === 0) stop();
    if (persist) try { storage?.setItem(FEEDBACK_STORAGE, JSON.stringify(settings)); } catch { /* Keep session preferences when storage is unavailable. */ }
    return { ...settings };
  }
  function preload() {
    for (const [id, file] of Object.entries(SOUND_FILES)) {
      if (sounds.has(id)) continue;
      try {
        const audio = createAudio();
        // Normalized PCM clips keep levels consistent and support older iPhones.
        audio.src = `./audio/${file}.wav`;
        audio.preload = 'auto';
        audio.volume = settings.volume;
        sounds.set(id, audio);
        audio.load();
      } catch { /* Audio support is optional; match actions still work. */ }
    }
  }
  function play(id) {
    if (settings.muted || settings.volume === 0 || isHidden() || !Object.hasOwn(SOUND_FILES, id)) return;
    preload();
    // One cue at a time keeps repeated edits from building a wall of sound.
    stop();
    const audio = sounds.get(id);
    if (!audio) return;
    try { audio.play()?.catch(() => {}); } catch { /* Autoplay policies or a failed file must never interrupt play. */ }
  }
  function sync(value) {
    try { configure(preferences(JSON.parse(value)), false); } catch { /* Ignore malformed cross-tab preferences. */ }
  }
  return { get settings() { return { ...settings }; }, configure, preload, play, stop, sync };
}

const activeEffects = new Map();
let vsEffect = null;
function clearVsEffect() {
  if (!vsEffect) return;
  clearTimeout(vsEffect.timer);
  vsEffect.button.classList.remove('vs-feedback');
  vsEffect = null;
}
export function clearEffects() {
  clearVsEffect();
  for (const { node, timer } of activeEffects.values()) { clearTimeout(timer); node.remove(); }
  activeEffects.clear();
}
export function showVsEffect() {
  const button = document.getElementById('view-toggle');
  if (!button) return;
  clearVsEffect();
  // Restart the pulse on every press, including quick switches in either direction.
  void button.offsetWidth;
  button.classList.add('vs-feedback');
  vsEffect = { button, timer: setTimeout(clearVsEffect, 650) };
}
export function showPlayerEffect({ player, effect }) {
  const card = document.querySelector(`.player-card[data-player="${player}"]`);
  if (!card) return;
  const previous = activeEffects.get(player);
  if (previous) { clearTimeout(previous.timer); previous.node.remove(); }
  const node = document.createElement('div');
  node.className = `gig-effect gig-effect-${effect}`;
  node.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'gig-effect-label';
  label.textContent = { shock: 'SHORT CIRCUIT', slash: 'GIG STOLEN', quickhack: 'GIG ACQUIRED', braindance: 'GIG ACQUIRED', eddies: '€$ UPDATED' }[effect];
  node.append(label);
  card.append(node);
  const timer = setTimeout(() => { node.remove(); activeEffects.delete(player); }, 1100);
  activeEffects.set(player, { node, timer });
}
