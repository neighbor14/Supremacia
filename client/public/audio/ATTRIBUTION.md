# Audio — Supremacia Digital

All sound effects are **synthesized in-browser** via the Web Audio API.  
No external audio files are loaded or shipped with the game.

## How sounds are generated

Each sound effect is defined as a synthesis recipe in `client/src/game/audio.ts`
using oscillators (sine, square, sawtooth) and filtered white-noise bursts
with ADSR-style amplitude envelopes.

No attribution is required — synthesis code is original work, owned by the project.

## Adding new sounds

1. Add a new key to the `SoundEffect` union type in `audio.ts`.
2. Add a corresponding entry to the `SOUNDS` record using `tone()` and/or `burst()`.
3. Call `playSound('your-new-key')` from any component.

## Adding file-based sounds (future)

Place `.ogg` or `.mp3` files in this directory (`/audio/`).  
Reference them via `/audio/filename.ogg` in the Vite public root.  
Update `audio.ts` accordingly and document attribution below.

| File | Source | Author | License | URL |
|------|--------|---------|---------|-----|
| *(none yet)* | | | | |
