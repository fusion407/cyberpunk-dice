# Cyberpunk Dice / Gig Tracker

A mobile-ready Cyberpunk TCG companion with Gig counters, a D6 roller, a turn tracker, overtime detection, and explained match results.

Run `npm start` from this directory, then open <http://localhost:4173>. No dependency installation is required.

Run `npm test` for the rule and offline checks, or `npm run check` for JavaScript syntax checks.

See [the app README](gig-tracker/README.md) for controls, victory rules, offline support, and hosting details. Source files are in `gig-tracker/dist/`.

## Deploy

Import this repository into Vercel. The included `vercel.json` deploys `gig-tracker/dist/` directly as a static site, with no dependency install or build step. Pushes to `main` update the production app automatically once the Vercel Git integration is connected.

Each device keeps its own match in browser storage. Two people can use one phone in face-to-face mode; this app does not synchronize a game between different phones.
