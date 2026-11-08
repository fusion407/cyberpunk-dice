# Sound effects and sources

Selected from [Cyberpunk 2077 SoundDB](https://sounddb.redmodding.org/) on November 7, 2026. Audio comes from Cyberpunk 2077 by CD PROJEKT RED; SoundDB is maintained by Zhincore with the Red Modding community.

| App trigger | SoundDB event and sound ID | Original download | App file |
| --- | --- | --- | --- |
| Steal: electric border on the player losing Gigs | [`quickhack_shortcircuit_mech` · 213913715](https://sounddb.redmodding.org/sfx/213913715) | [Ogg](https://static.zhincore.eu/cp/sfx/213913715.ogg) | `short-circuit.wav` |
| Steal: red slash on the player losing Gigs | [`w_melee_katana_impact_flesh` · 340855277](https://sounddb.redmodding.org/sfx/340855277) | [Ogg](https://static.zhincore.eu/cp/sfx/340855277.ogg) | `katana-slash.wav` |
| Gain or restore a Gig: quickhack variant | [`quickhack_ping` · 267319548](https://sounddb.redmodding.org/sfx/267319548) | [Ogg](https://static.zhincore.eu/cp/sfx/267319548.ogg) | `quickhack.wav` |
| Gain or restore a Gig: braindance variant | [`g_sc_bd_rewind_pause` / `g_sc_bd_rewind_pause_forced` · 161544332](https://sounddb.redmodding.org/sfx/161544332) | [Ogg](https://static.zhincore.eu/cp/sfx/161544332.ogg) | `braindance.wav` |
| Save a changed Gig face or reroll to a different face: eddies | [`ui_jingle_money` · 1071788574](https://sounddb.redmodding.org/sfx/1071788574) | [Ogg](https://static.zhincore.eu/cp/sfx/1071788574.ogg) | `eddies.wav` |

The two steal variants have equal probability, as do the two acquisition variants. One cue plays per completed action, including a multi-Gig steal. No cues play for cancelled dialogs, unchanged faces, failed moves, undo, loading a save, cross-tab match synchronization, free rolls, or administrative inventory corrections. When rolling a Gig and ending the turn together, the effect stays on the player who received the Gig.

Original downloads are preserved as `.ogg` files beside their playable derivatives. The app uses mono 24 kHz, 16-bit PCM WAV versions resampled with the browser's OfflineAudioContext, then peak-normalized to 0.7 (about −3.1 dBFS). This keeps playback levels consistent and works on older iPhones without Ogg support. Clips retain their complete duration; a new cue stops the previous one. Default volume is 45%.

`sources.json` records original URLs, IDs, durations, and SHA-256 hashes for both formats. The app caches the five WAV clips with its service worker and makes no SoundDB requests at runtime. Sound, volume and visual preferences are saved independently from the match. Visuals respect the system's reduced-motion preference and can be disabled independently from audio.
