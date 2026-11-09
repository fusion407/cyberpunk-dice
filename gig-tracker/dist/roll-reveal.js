import { DIE_TYPES } from './game.js';

const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const outlines = {
  4: 'M60 8 112 112H8Z M60 8v68L8 112m52-36 52 36',
  6: 'M60 6 110 34v60l-50 28L10 94V34Z M10 34l50 29 50-29M60 63v59',
  8: 'M60 4 112 64 60 124 8 64Z M8 64h104M60 4v120',
  10: 'M60 4 112 42 98 106 60 124 22 106 8 42Z M60 4 50 64l10 60M8 42l42 22 62-22M50 64l48 42M50 64 22 106',
  12: 'M60 4 111 42 92 112H28L9 42Z M60 32 88 52 77 86H43L32 52Z M60 4v28m51 10-23 10m4 60-15-26m-49 26 15-26M9 42l23 10',
  20: 'M60 4 112 34 106 96 60 124 14 96 8 34Z M60 4 36 74 112 34 60 124 8 34 84 74 60 4M14 96 36 74h48l22 22'
};

export function summarizeRoll(sides, values) {
  if (!DIE_TYPES.includes(sides) || !Array.isArray(values) || values.length < 1 || values.length > 6 || values.some(v => !Number.isInteger(v) || v < 1 || v > sides)) throw new RangeError('Invalid dice reveal');
  return { sides, values: [...values], total: values.reduce((sum, value) => sum + value, 0), maximum: values.every(value => value === sides), hasMaxFace: values.some(value => value === sides) };
}

export function createRollReveal({ dialog, getSettings, playSound, win = window }) {
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  let timer, ticker, active = null;
  function release() {
    if (!active?.onSettled) return;
    const callback = active.onSettled; active.onSettled = null; callback();
  }
  function cleanup() {
    clearTimeout(timer); clearInterval(ticker); release(); active = null;
  }
  function close() { cleanup(); if (dialog.open) dialog.close(); }
  function finish() {
    if (!active || !dialog.open) return;
    clearTimeout(timer); clearInterval(ticker);
    const summary = active.summary;
    if (!getSettings().effects || reduced.matches) dialog.classList.remove('roll-reveal-animated');
    dialog.classList.remove('is-rolling'); dialog.classList.add('is-revealed');
    dialog.querySelector('.reveal-dice').removeAttribute('aria-hidden');
    dialog.querySelector('.reveal-status').textContent = summary.maximum ? 'MAXIMUM ROLL' : 'RESULT LOCKED';
    dialog.querySelector('.reveal-announcement').textContent = `You rolled ${summary.values.join(', ')}. Total ${summary.total}.`;
    dialog.querySelector('.reveal-continue').disabled = false;
    release();
  }
  function show({ sides, values, title = 'Dice roll', subtitle = '', note = '', table = false, player = 0, animate = true, sound = 'roll', onSettled }) {
    const summary = summarizeRoll(sides, values);
    close();
    const motion = animate && getSettings().effects && !reduced.matches;
    active = { summary, onSettled };
    dialog.className = `roll-reveal ${motion ? 'roll-reveal-animated is-rolling' : 'is-revealed'} ${table && player === 1 ? 'table-top-roll' : ''}`;
    dialog.innerHTML = `<div class="reveal-heading"><span class="eyebrow">NIGHT CITY / CHANCE ENGINE</span><button type="button" class="icon-button reveal-close" aria-label="Close roll result">×</button></div><h2 id="roll-reveal-title">${esc(title)}</h2><p class="reveal-subtitle">${esc(subtitle)}</p><div class="reveal-stage"><span class="reveal-orbit" aria-hidden="true"></span><ul class="reveal-dice ${values.length === 1 ? 'single-die' : 'multiple-dice'}" ${motion ? 'aria-hidden="true"' : ''}>${summary.values.map((value, i) => `<li class="reveal-die ${value === sides ? 'maximum-face' : ''}" style="--die-index:${i}" data-value="${value}" role="img" aria-label="D${sides} showing ${value}"><small>D${sides}</small><div class="reveal-poly"><svg viewBox="0 0 120 128" aria-hidden="true"><path d="${outlines[sides]}"/></svg><strong class="reveal-value">${value}</strong><span class="reveal-scramble" aria-hidden="true">?</span></div><span class="reveal-face-note">${value === sides ? 'MAX FACE' : `OF ${sides}`}</span></li>`).join('')}</ul></div><div class="reveal-result"><span class="reveal-status">${motion ? 'ROLLING…' : summary.maximum ? 'MAXIMUM ROLL' : 'RESULT LOCKED'}</span><div class="reveal-total"><span>${summary.values.length}D${sides} / TOTAL</span><strong>${summary.total}</strong></div></div><p class="reveal-note">${esc(note)}</p><p class="sr-only reveal-announcement" role="status" aria-live="polite" aria-atomic="true">${motion ? 'Rolling dice.' : `You rolled ${summary.values.join(', ')}. Total ${summary.total}.`}</p><button type="button" class="primary-button reveal-continue" ${motion ? 'disabled' : ''}>Continue →</button>`;
    dialog.querySelector('.reveal-close').addEventListener('click', close);
    dialog.querySelector('.reveal-continue').addEventListener('click', close);
    dialog.showModal();
    // One cue per reveal: a restrained success stinger for any highlighted max face.
    if (summary.hasMaxFace) playSound('maxFace');
    else if (sound) playSound(sound);
    if (motion) {
      let frame = 0;
      ticker = setInterval(() => {
        frame++;
        dialog.querySelectorAll('.reveal-scramble').forEach((node, i) => { node.textContent = String((frame * 7 + i * 3) % sides + 1); });
      }, 65);
      timer = setTimeout(finish, 720);
    } else release();
  }
  dialog.addEventListener('close', () => { if (!dialog.open) cleanup(); });
  reduced.addEventListener('change', () => { if (reduced.matches) finish(); });
  return { show, close, finish, get isOpen() { return dialog.open; } };
}
