export function installHelp(nav = navigator) {
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  if (ios) return {
    title: 'Install on iPhone or iPad',
    steps: ['Open your browser’s Share menu.', 'Choose Add to Home Screen.', 'Leave Open as Web App on if shown, then tap Add.'],
    note: 'If Add to Home Screen is missing, open this page in Safari and try its Share menu.'
  };
  return {
    title: /Android/i.test(nav.userAgent) ? 'Install on Android' : 'Install from your browser',
    steps: ['Open your browser’s menu (⋮ or …).', 'Choose Install app or Add to Home screen.', 'Confirm Install or Add, then open Gig Tracker from your home screen.'],
    note: 'If these options are missing, open this page in Chrome or Edge on Android, or use Safari’s Share menu on iPhone and iPad.'
  };
}

export function setupInstall({ win = window, nav = navigator, promotion, button, onHelp, onInstalled = () => {}, notify = () => {} }) {
  const mobile = win.matchMedia('(max-width: 1200px), (any-pointer: coarse)');
  const appDisplay = win.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)');
  let deferredPrompt = null, prompting = false, installed = false, accepted = false;
  const runningAsApp = () => appDisplay.matches || nav.standalone === true;
  function render() {
    promotion.hidden = !win.isSecureContext || !mobile.matches || runningAsApp() || installed || accepted;
    button.disabled = prompting;
    button.setAttribute('aria-busy', String(prompting));
  }
  win.addEventListener('beforeinstallprompt', event => {
    if (!mobile.matches || runningAsApp() || installed) return;
    event.preventDefault();
    deferredPrompt = event;
    render();
  });
  win.addEventListener('appinstalled', () => {
    installed = true; deferredPrompt = null;
    render(); onInstalled(); notify('Gig Tracker installed. Open it from your home screen.');
  });
  button.addEventListener('click', async () => {
    if (prompting || installed || accepted || runningAsApp()) return;
    if (!deferredPrompt) { onHelp(); return; }
    const prompt = deferredPrompt;
    deferredPrompt = null; prompting = true; render();
    try {
      // Call prompt in the user's click handler, before any await, and use it once.
      const result = await prompt.prompt();
      const choice = prompt.userChoice ? await prompt.userChoice : result;
      if (choice?.outcome === 'accepted') {
        accepted = true;
        if (!installed) notify('Installation requested. Follow your browser to finish.');
      }
    } catch { onHelp(); }
    finally { prompting = false; render(); }
  });
  mobile.addEventListener('change', render);
  appDisplay.addEventListener('change', render);
  win.addEventListener('pageshow', render);
  render();
}
