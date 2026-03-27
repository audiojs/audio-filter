## Goal

Collection of canonical implementation of audio-domain filters.
Useful in audio applications and packages, first of all web-audio-api, audio and others.

## Aspects

Structure: flat, code is clean, one level.
Documentation: flat, one-pager, with all plots available, clean.
Repository: all necessary aspects properly covered.

## Demo

In audio js website - allows choosing filter, seeing its core characteristics.
Clean, minimal, audio-style charts, interactive.
One-button test on sample file, with controls.
File is rendered via waveform (need wavefont player)
Can drop any other file to apply filter, then download.

## More

**Is there anything else?**
Two things not yet covered: (1) a clear explanation of the two API shapes — coefficient-returning (`aWeighting(fs) → SOS[]`) vs in-place processing (`moogLadder(data, params)`) — users will trip on this without documentation. (2) Block/streaming usage pattern: the state-in-params idiom (`params._s`) is the key insight — document it explicitly so users know to reuse the same params object across consecutive buffers.

**What would unlock extra value proposition?**
Frequency response plots for every filter in the README — rendered as SVGs or PNGs. Makes the package self-documenting: you see what you're getting before you import it. Secondary: a freqz utility re-export so users can generate their own plots without pulling in digital-filter directly.

**What is needed for project to self-distribute?**
1. Being the correct Google result for "moog ladder javascript", "gammatone filter js", "a-weighting javascript" — SEO via README and JSDoc. 2. A demo that people link to. 3. Correct implementations that pass when tested against spec values — reputation compounds. The vocoder, Moog, gammatone are the gravity wells: people searching for those land here and find everything else.

**What's the SPIN it solves?**
- Situation: Audio dev needs filter X for a JS project
- Problem: Web Audio API only has basic biquads and requires AudioContext; Tone.js is 200kb+; copying academic code gives unstable or incorrect results
- Implication: Wrong filters, bloated dependencies, reinventing solved problems
- Need: Correct, minimal, production-ready filters that work anywhere — Node, browser, Workers, offline

**What pressure would turn this into diamond?**
Being *cited* rather than copied. If other audio packages (`web-audio-api`, `audio`, `tone`) list this as a dependency rather than reimplementing their own filters, the correctness standard becomes a forcing function. The Moog ZDF implementation (citing Zavalishin 2012) and the IEC-compliant A-weighting are the two strongest candidates for this — they're the hardest to get right.

**What would unlock integration?**
The coefficient-returning filters already integrate cleanly into any pipeline via SOS arrays. The in-place filters need: (1) a clear statement that they're side-effect-free on params except `_`-prefixed keys, (2) TypeScript types (even a single `.d.ts` stub covers 80% of IDEs). The split signature (`vocoder(carrier, modulator, params)` vs `moogLadder(data, params)`) is the one rough edge — document it, don't fight it.

**What docs would future me/agents/users need?**
Per filter: params with types and defaults, what it does in one sentence, reference citation, frequency response image. Package-level: the two API shapes, the block-processing pattern (reuse params), which filters are stateful vs stateless. A table of all filters with category, type (SOS | in-place), key params.


## Extra questions


### ∞ INTENTION — OFFERING OR EGO TRIP?

**What would qualify as an offering?**
An offering is work that removes its author — where the user encounters the filter, not the craftsman. This qualifies when: the Moog implementation is indistinguishable from a textbook derivation, when the A-weighting passes IEC 61672 to the letter, when a stranger can read the code without knowing your name and trust it. Ego trip is: unusual naming, clever abstractions for their own sake, over-engineering to show capability. The test: would Prabhupada find the pride? The flat structure, standard names, cited references — these point toward offering. Watch for: adding filters that aren't canonical yet, making the demo about style.

**What secret analogy unites this with nature?**
A filter is a prism — it doesn't add color, it reveals which frequencies were always present. The gammatone filter models the cochlea: the ear itself is a bank of overlapping filters. This code is not imitating nature; it is transcribing how nature processes sound. The Moog ladder is a physical circuit rendered in arithmetic. There is no gap between the analog and the digital here — both are approximations of the same underlying differential equation. Fourier would see unity: every filter is a weight on the spectrum, nothing more. That is not ego projecting patterns — it is the fact that all audio processing *is* spectral manipulation.

**What paradox lives here?**
It shapes sound but makes no sound. It's a mirror, not a voice. Also: the most powerful filters (Moog self-oscillation, vocoder) require the most invisible infrastructure — the complexity hides completely inside a one-line call. You're building forever (correct implementations referenced for years) in something that takes five minutes to install and forget. The promise of zero ceremony is exactly what requires the most ceremony to build correctly.

**What's the territory I'm entering?**
Existing landscape: `Tone.js` (comprehensive, heavy, class-based, browser-centric), Web Audio API (browser-only, black box, no offline), `biquad.js` / `audio-biquad` (only basic EQ shapes), scattered academic code of uncertain numerical stability. Nobody has: Moog ZDF + diode ladder + Korg35 + gammatone + bark bank + ITU-468 + vocoder + crossfeed in one minimal ESM package with tests. The anti-pattern to avoid: becoming a framework. The pattern to follow: UNIX philosophy — each filter does one thing, composes freely. Category: *audio DSP primitives*, not "audio framework".

**What are all the ways this could be useful?**
Main: signal processing pipelines, audio effects in browsers/Node, metering/loudness tools (A/K/C-weighting, ITU-468), psychoacoustic analysis (gammatone, ERB, bark banks), synthesizer voice filters (Moog, Korg35). Hidden: speech processing (pre-emphasis, formant), music information retrieval, audio codec development (noise shaping, pink noise), hearing aid simulation (gammatone), podcast/broadcast tools (k-weighting, LUFS prep). Replaces: copying DSP textbook code, depending on Tone.js for one filter, Web Audio API for offline processing.

**Who already solved for an adjacent pain?**
Tone.js got the API ergonomics right (chainable, musical) but is 200kb and class-based. Web Audio API got the browser integration right but is a black box. `digital-filter` (this package's own dependency) got the primitives right. Zavalishin's "Art of VA Filter Design" solved the math. What they all missed: a flat, correct, ESM collection of the *specific* filters that appear in real audio applications — weighting curves, perceptual banks, analog circuit models — at zero framework cost. The combination of their best ideas looks like exactly this package.

**What would be ideal result — the timeless form?**
The one thing it must nail: *correctness*. Every filter verifiable against its standard or reference. If the Moog doesn't match Zavalishin, if the A-weighting doesn't pass IEC 61672 — nothing else matters. Success sounds like: playing audio through the Moog and it sounds exactly like the hardware. It feels like reading code that looks like math. It is inevitable because sound has physics and physics has equations and these are those equations in runnable form. The metric: can another audio engineer read the implementation, compare it to the reference, and find no errors? The irreducible essence — taste in water — is: *correct DSP, no ceremony.*

**What's the theoretically pure form?**
Before constraints: one function per filter, named after its reference, parameters named after the paper's variables, behavior identical to the continuous-time analog prototype. Zero dependencies. The limit as versions → ∞: the code becomes a running excerpt from a DSP textbook. The Platonic ideal is the implementations being *definitional* — not "here's one way to do a Moog filter" but "this *is* the Moog ladder in JS." The contradiction it must hold: accessible to audio developers who aren't DSP researchers, yet correct enough for DSP researchers to cite.

**What's the theoretical minimum?**
One function: `filter(data, params)`. Data goes in shaped, data comes out. State lives in params invisibly. That seed contains the whole tree — add filters one by one, all sharing the same calling convention. The version with zero ornamentation is exactly what exists now: a flat folder of `.js` files, one export per file, one entry point that re-exports all of them.

**What's the single-player value?**
Before anyone else uses this: you needed a Moog filter for a browser synth. You imported one line, called one function, heard the self-oscillation. That's the whole value. No AudioContext. No class instantiation. No config. The first user stays because it works correctly the first time.

**Is this so clear a stranger would grasp it?**
The structure, yes — flat files, obvious names. The API split (SOS-returning vs in-place), not yet — needs one paragraph. The block-processing pattern (reuse params across buffers), not at all — needs an example. Gauss would cut: the two API shapes unified into one paragraph with one example each. *Pauca sed matura.* The maximum/minimum principle: each filter has exactly the parameters it needs and no others, defaults that cover 90% of use cases, state that manages itself.

**What's the boundary — where does this end?**
In: canonical audio filters with established references and clear parameter sets. Out: synthesis (oscillators, envelopes as primary tools), audio I/O, Web Audio API nodes, effects without a DSP basis (reverb, delay lines as primary). The feature users will beg for that must be refused: a Reverb. It belongs in a different package — too many design decisions, no single canonical implementation. What would betray it: becoming `audio-fx`, adding classes, requiring a sample rate at construction time. The bone: correct filter implementations. The flesh: demos, plots, the streaming pattern doc.

**What's the soul — the spark, the secret, moat, x-factor?**
The moat: *cited correctness*. You can't copy "passes IEC 61672" — you have to verify it. The state-in-params idiom is genuinely clever: state lives in the params object under `_`-prefixed keys, so you never manage separate state objects. This isn't documented anywhere — it's the hidden API. The spark: this is the first JS package where `moogLadder(data, {fc: 1000, resonance: 1})` self-oscillates correctly, where `gammatone` models the actual cochlea, where `itu468` returns the exact ITU measurement curve. The beauty is that the math is visible in the code — `tan(PI * fc / fs)` is the bilinear transform prewarp, right there, legible. The "whoa" moment: run the Moog at resonance=1 and it oscillates indefinitely from a single sample. That is physics, running in a browser, in 40 lines.

**What's the spine everything hangs on?**
The happy path: developer needs filter X, imports it, calls it with a buffer and sample rate, it works. 90% of users never read the implementation. What breaks under scale: the vocoder (O(nBands × N) allocations per call), and stateful filters that reset state when params are recreated. The gravity: the `filter(data, params)` calling convention — everything orbits around it. Edge cases that matter: sample rate (always default to 44100), self-oscillation stability (tested), block boundaries (state preserved in params). Edge cases that are noise: 32-bit vs 64-bit float (both work), stereo handling (crossfeed is the exception, not the rule).

**What's the price — and am I willing to pay it?**
The trade: breadth vs depth. 30 filters at correct-but-not-exhaustive vs 5 filters with every mode, parameter range, and edge case covered. The sacrifice kept: the vocoder and gammatone and bark bank — they make this more than just another biquad wrapper. The sacrifice to make: resisting the temptation to add filters that aren't canonical yet (chorus, phaser, reverb) because they'd dilute the positioning. What will be regretted: not having frequency response images in the initial release — those are the thing that makes the package self-evident.

**What unlocks everything?**
The decision already made correctly: flat structure, consistent convention, no classes. What remains uncommitted to: the demo. The demo decides whether this is a developer tool or a product. Build the demo at audiojs.dev with interactive filter selection and frequency response plots — that single page does more distribution than any README. It's reversible: build it or don't. The irreversible: the API shape. It's already correct — don't change it.
