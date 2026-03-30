# audio-filter [![ci](https://github.com/audiojs/audio-filter/actions/workflows/ci.yml/badge.svg)](https://github.com/audiojs/audio-filter/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/audio-filter)](https://npmjs.org/package/audio-filter)

Canonical audio filter implementations.<br>

<table><tr><td valign="top">

**[Weighting](#weighting)**<br>
<sub>[A-weighting](#a-weighting) · [C-weighting](#c-weighting) · [K-weighting](#k-weighting) · [ITU-R 468](#itu-r-468) · [RIAA](#riaa)</sub>

**[Auditory](#auditory)**<br>
<sub>[Gammatone](#gammatone) · [Octave bank](#octave-bank) · [ERB bank](#erb-bank) · [Bark bank](#bark-bank) · [Mel bank](#mel-bank)</sub>

**[Analog](#analog)**<br>
<sub>[Moog ladder](#moog-ladder) · [Diode ladder](#diode-ladder) · [Korg35](#korg35) · [Oberheim](#oberheim)</sub>

</td><td valign="top">

**[Speech](#speech)**<br>
<sub>[Formant](#formant) · [Vocoder](#vocoder) · [LPC](#lpc)</sub>

**[EQ](#eq)**<br>
<sub>[Graphic EQ](#graphic-eq) · [Parametric EQ](#parametric-eq) · [Crossover](#crossover) · [Crossfeed](#crossfeed)</sub>

**[Effect](#effect)**<br>
<sub>[DC blocker](#dc-blocker) · [Comb](#comb-filter) · [Allpass](#allpass) · [Pre-emphasis](#pre-emphasis--de-emphasis) · [Resonator](#resonator) · [Envelope](#envelope-follower) · [Slew limiter](#slew-limiter) · [Noise shaping](#noise-shaping) · [Pink noise](#pink-noise) · [Spectral tilt](#spectral-tilt) · [Variable bandwidth](#variable-bandwidth) · [Phaser](#phaser) · [Flanger](#flanger) · [Chorus](#chorus) · [Wah](#wah)</sub>

</td></tr></table>

## Install

```
npm install audio-filter
```

```js
// import everything
import * as filter from 'audio-filter'

// import by domain
import { aWeighting, kWeighting } from 'audio-filter/weighting'
import { gammatone, melBank } from 'audio-filter/auditory'
import { moogLadder, oberheim } from 'audio-filter/analog'
import { vocoder, lpcAnalysis } from 'audio-filter/speech'
import { parametricEq, crossover } from 'audio-filter/eq'
import { phaser, chorus, wah } from 'audio-filter/effect'
```


## API

All filters share one shape:

```js
filter(buffer, params)   // → buffer (modified in-place)
```

Takes an `Array`/`Float32Array`/`Float64Array`, modifies it in-place, returns it. Pass the same params object on every call to persist state across blocks automatically:

```js
let params = { fc: 1000, resonance: 0.5, fs: 44100 }
for (let buf of stream) moogLadder(buf, params)
```

For frequency analysis, weighting filters expose a `.coefs(fs)` method returning a second-order sections (SOS) array — `[{b0, b1, b2, a1, a2}, ...]`, one biquad per section — for use with `digital-filter`:

```js
import { freqz, mag2db } from 'digital-filter/core'

let sos  = aWeighting.coefs(44100)
let resp = freqz(sos, 2048, 44100)
let db   = mag2db(resp.magnitude)
```


## Weighting

Standard measurement curves. Each is defined by a standards body to a specific curve shape and normalization.

![Weighting filters comparison](plot/weighting.svg)

| filter | standard | normalized |
|---|---|---|
| `aWeighting` | IEC 61672-1:2013 | 0 dB at 1 kHz |
| `cWeighting` | IEC 61672-1:2013 | 0 dB at 1 kHz |
| `kWeighting` | ITU-R BS.1770-4:2015 | — |
| `itu468` | ITU-R BS.468-4:1986 | +12.2 dB at 6.3 kHz |
| `riaa` | RIAA 1954 / IEC 60098 | 0 dB at 1 kHz |


### A-weighting

Models how the ear perceives loudness — attenuates low and very high frequencies.

**Transfer function**: $H(s) = \frac{Ks^4}{(s+\omega_1)^2(s+\omega_2)(s+\omega_3)(s+\omega_4)^2}$<br>
**Poles**: $\omega_1 = 2\pi \cdot 20.6\,\text{Hz}$, $\omega_2 = 2\pi \cdot 107.7\,\text{Hz}$, $\omega_3 = 2\pi \cdot 737.9\,\text{Hz}$, $\omega_4 = 2\pi \cdot 12194\,\text{Hz}$<br>
**Implementation**: matched z-transform ($z_k = e^{s_k/f_s}$), 3 SOS sections — no frequency warping near Nyquist<br>
**Normalization**: 0 dB at 1 kHz (IEC requirement)

```js
import { aWeighting } from 'audio-filter/weighting'

let p = { fs: 44100 }
for (let buf of stream) aWeighting(buf, p)   // A-weighted stream
```

**Standard**: IEC 61672-1:2013[^1]<br>
**Use when**: measuring SPL, noise, OSHA compliance, audio quality<br>
**Not for**: loudness in broadcast (use K-weighting), noise annoyance (use ITU-468)

![A-weighting](plot/a-weighting.svg)


### C-weighting

Like A-weighting but flatter — less rolloff at low and high frequencies.

**Transfer function**: $H(s) = \frac{Ks^2}{(s+\omega_1)^2(s+\omega_4)^2}$<br>
**Poles**: $\omega_1 = 2\pi \cdot 20.6\,\text{Hz}$, $\omega_4 = 2\pi \cdot 12194\,\text{Hz}$ (same as A-weighting outer poles)<br>
**Implementation**: matched z-transform, 2 SOS sections

```js
cWeighting(buffer, { fs: 44100 })
```

**Standard**: IEC 61672-1:2013[^1]<br>
**Use when**: peak sound level measurement, where A-weighting over-penalizes bass<br>
**Compared to A**: rolls off below 31.5 Hz and above 8 kHz; flat 31.5 Hz–8 kHz

![C-weighting](plot/c-weighting.svg)


### K-weighting

The loudness measurement curve — a high shelf plus a highpass. Used to compute LUFS.

**Stage 1**: pre-filter — high shelf +4 dB above ~1.5 kHz (head diffraction simulation)<br>
**Stage 2**: RLB highpass — 2nd-order Butterworth at ~38 Hz (removes sub-bass)<br>
**Exact coefficients at 48 kHz**: specified in BS.1770 Annex 1; this implementation uses them verbatim

```js
import { kWeighting } from 'audio-filter/weighting'

kWeighting(buffer, { fs: 48000 })   // exact ITU-R BS.1770 coefficients
kWeighting(buffer, { fs: 44100 })   // approximated via biquad design
```

**Standard**: ITU-R BS.1770-4:2015[^2], EBU R128<br>
**Use when**: computing integrated loudness (LUFS/LKFS), broadcast loudness normalization<br>
**Not for**: A-weighted SPL measurement (different shape, different standard)

![K-weighting](plot/k-weighting.svg)


### ITU-R 468

Peaked noise weighting — peaks at +12.2 dB near 6.3 kHz — models how humans actually perceive noise annoyance.

**Shape**: rises steeply from 31.5 Hz, peaks at +12.2 dB at 6.3 kHz, rolls off above 10 kHz<br>
**Implementation**: practical IIR approximation via cascaded biquads, within ~1 dB of spec

```js
itu468(buffer, { fs: 48000 })
```

**Standard**: ITU-R BS.468-4:1986[^3] (original CCIR 468, 1968)<br>
**Rationale**: human hearing is more sensitive to short noise bursts than sine tones; 468 weights accordingly<br>
**Use when**: measuring noise in broadcast equipment, tape noise, hum and hiss<br>
**Compared to A-weighting**: 6.3 kHz peak makes it harsher on hiss; preferred in European broadcast

![ITU-R 468](plot/itu468.svg)


### RIAA

Playback equalization for vinyl records — a shelving curve with three time constants.

**Transfer function**: $H(s) = \frac{1 + sT_2}{(1 + sT_1)(1 + sT_3)}$<br>
**Time constants**: $T_1 = 3180\,\mu\text{s}$ (50.05 Hz pole), $T_2 = 318\,\mu\text{s}$ (500.5 Hz zero), $T_3 = 75\,\mu\text{s}$ (2122 Hz pole)<br>
**Implementation**: 1 SOS section via bilinear transform, normalized 0 dB at 1 kHz

```js
import { riaa } from 'audio-filter/weighting'

riaa(phonoSignal, { fs: 44100 })   // correct vinyl playback
```

**Standard**: RIAA 1954, IEC 60098:1987[^4]<br>
**Purpose**: playback de-emphasis undoes the mastering pre-emphasis applied during vinyl cutting<br>
**Shape**: boosts bass ~+20 dB at 20 Hz, rolls off treble; at playback restores flat response

![RIAA equalization](plot/riaa.svg)


## Auditory

Models of the human auditory system — how the cochlea and brain decompose sound into frequency channels. Used in psychoacoustics, music information retrieval, and hearing aid design.


### Gammatone

The cochlear filter — bandpass tuned to one frequency, decaying oscillation, mimics an inner hair cell.

**Model**: cascade of complex one-pole filters; 4th-order is the standard cochlear approximation<br>
**Bandwidth**: $\text{ERB} = 24.7\left(\frac{4.37 f_c}{1000} + 1\right)\,\text{Hz}$<br>
**Implementation**: complex resonator with gain normalization to 0 dB at $f_c$

```js
import { gammatone } from 'audio-filter/auditory'

let params = { fc: 1000, fs: 44100 }
gammatone(buffer, params)   // bandpass at 1 kHz with cochlear envelope
```

**Origin**: Patterson et al. (1992)[^5]<br>
**Use when**: cochlear modeling, auditory scene analysis, psychoacoustic feature extraction<br>
**Compared to Butterworth bandpass**: gammatone has asymmetric temporal envelope matching biological data

![Gammatone filter](plot/gammatone.svg)

Reuse `params` across blocks — state in `params._s`, gain cached in `params._gain`.

![Gammatone bank (6 center frequencies)](plot/gammatone-bank.svg)


### Octave bank

ISO/IEC fractional-octave filter bank — the standard for acoustic measurement and spectrum analysis.

**Center frequencies**: ISO 266 series — $f_c = 1000 \cdot G^{k/n}$, $G = 10^{3/10}$<br>
**Bandwidth**: each band spans $f_c \cdot G^{-1/(2n)}$ to $f_c \cdot G^{+1/(2n)}$<br>
**1/1 octave**: 10 bands (31.5–16 kHz) — coarse; **1/3 octave**: 30 bands — standard; **1/6+**: psychoacoustics<br>
**Returns**: array of `{ fc, coefs }` — each band is a biquad bandpass section

```js
import { octaveBank } from 'audio-filter/auditory'
import { filter } from 'digital-filter'

let bands = octaveBank(3, 44100)   // 1/3-octave, 30+ bands
for (let band of bands) {
  let buf = Float64Array.from(signal)
  filter(buf, { coefs: band.coefs })
  spectrum.push({ fc: band.fc, energy: rms(buf) })
}
```

**Standard**: IEC 61260-1:2014[^6], ANSI S1.11:2004<br>
**Use when**: acoustic measurement, noise assessment, spectrum visualization

![1/3-octave filter bank](plot/octave-bank.svg)


### ERB bank

Equivalent Rectangular Bandwidth scale — how the auditory system actually spaces its channels.

**ERB formula**: $\text{ERB}(f_c) = 24.7\left(\frac{4.37 f_c}{1000} + 1\right)$<br>
**Spacing**: ~1 ERB between adjacent channels — logarithmic above 1 kHz, more linear below<br>
**Returns**: array of `{ fc, erb, bw }` descriptors; apply `gammatone` at each `fc` for the filter bank

```js
import { erbBank, gammatone } from 'audio-filter/auditory'

let bands  = erbBank(44100)
let states = bands.map(b => ({ fc: b.fc, fs: 44100 }))

for (let buf of stream) {
  let channels = bands.map((_, i) => {
    let b = Float64Array.from(buf)
    gammatone(b, states[i])
    return b
  })
}
```

**Origin**: Moore & Glasberg (1983, 1990)[^7]<br>
**Use when**: speech processing, hearing models, auditory feature extraction<br>
**Compared to Bark**: ERB is more accurate above 500 Hz; Bark is the psychoacoustic masking model

![ERB filter bank](plot/erb-bank.svg)


### Bark bank

Zwicker's 24 critical bands — the psychoacoustic foundation of perceptual audio coding.

**Scale**: 24 bands spanning 20 Hz–20 kHz; named after Heinrich Barkhausen<br>
**Band widths**: ~100 Hz wide below 500 Hz; ~20% of center frequency above<br>
**Returns**: array of `{ bark, fLow, fHigh, fc, coefs }` — each band is a biquad bandpass section

```js
import { barkBank } from 'audio-filter/auditory'
import { filter } from 'digital-filter'

let bands = barkBank(44100)   // 24 critical bands
for (let band of bands) {
  let buf = Float64Array.from(signal)
  filter(buf, { coefs: band.coefs })
  excitation[band.bark] = rms(buf)
}
```

**Origin**: Zwicker (1961)[^8]<br>
**Use when**: perceptual audio coding (MP3/AAC use Bark-like groupings), loudness models, masking<br>
**Compared to ERB**: Bark bands are wider and fewer; ERB is more accurate for hearing science

![Bark critical band filter bank](plot/bark-bank.svg)


### Mel bank

Mel-frequency triangular filter bank — the standard front-end for speech recognition and music information retrieval.

**Scale**: $\text{mel}(f) = 2595 \log_{10}(1 + f/700)$ (O'Shaughnessy variant)[^18]<br>
**Bands**: equally spaced in mel scale; each band is a triangle spanning 3 adjacent mel points<br>
**Returns**: array of `{ fc, fLow, fHigh, mel }` — band descriptors for MFCC computation

```js
import { melBank } from 'audio-filter/auditory'

let bands = melBank(44100)                          // 26 bands (default)
let bands = melBank(16000, { nFilters: 40 })        // 40 bands, telephony rate
let bands = melBank(44100, { fmin: 300, fmax: 8000 })
```

**Use when**: MFCC feature extraction, speech recognition, music genre classification, audio fingerprinting<br>
**Compared to ERB/Bark**: mel is the most widely used in ML; ERB is more physiologically accurate

![Mel filter bank](plot/mel-bank.svg)


## Analog

Discrete-time models of analog circuits — each named after the hardware it replicates. Nonlinear, stateful, process in-place. The filters in synthesizers.


### Moog ladder

Robert Moog's 4-pole transistor ladder, 1965 — the most imitated filter in electronic music.

**Circuit**: 4 cascaded one-pole transistor ladder sections, global feedback from output to input<br>
**Implementation**: Zero-delay feedback (ZDF) via trapezoidal integration — Zavalishin (2012)[^9], Ch. 6<br>
**Response**: $-24\,\text{dB/oct}$ lowpass; resonance peak at $f_c$; self-oscillation (sine wave) at resonance=1<br>
**Nonlinearity**: $\tanh$ saturation at input (transistor ladder characteristic)

```js
import { moogLadder } from 'audio-filter/analog'

let params = { fc: 800, resonance: 0.7, fs: 44100 }
moogLadder(buffer, params)

// Self-oscillation — runs indefinitely from a single impulse
let silent = new Float64Array(4096); silent[0] = 0.01
moogLadder(silent, { fc: 1000, resonance: 1, fs: 44100 })
```

**Patent**: Moog (1965) US3475623[^10]<br>
**vs Diode ladder**: Moog saturates only at input; diode saturates at each stage — different character at high resonance

![Moog ladder resonance sweep](plot/moog-ladder.svg)


### Diode ladder

Roland TB-303 / EMS VCS3 style — per-stage saturation gives the characteristic acid "squelch".

**Circuit**: Roland TB-303, EMS VCS3, EDP Wasp<br>
**Key difference from Moog**: $\tanh$ nonlinearity at each of 4 stages, not just input; feedback is a weighted sum of all stage outputs<br>
**Character**: preserves bass at high resonance; more "squelchy" and aggressive than Moog<br>
**Implementation**: ZDF — Zavalishin (2012)[^9]; Pirkle (2019)[^11], Ch. 10<br>
**Stability**: stable up to resonance=0.95; bounded output

```js
import { diodeLadder } from 'audio-filter/analog'

let params = { fc: 500, resonance: 0.8, fs: 44100 }
diodeLadder(buffer, params)
```

![Diode ladder](plot/diode-ladder.svg)


### Korg35

Korg MS-10/MS-20, 1978 — 2-pole filter with lowpass and complementary highpass outputs.

**Topology**: 2 cascaded one-pole sections with nonlinear feedback; HP = input − LP<br>
**Response**: $-12\,\text{dB/oct}$; aggressive resonance due to nonlinear feedback; both LP and HP from one circuit

```js
import { korg35 } from 'audio-filter/analog'

korg35(buffer, { fc: 1000, resonance: 0.5, type: 'lowpass',  fs: 44100 })
korg35(buffer, { fc: 1000, resonance: 0.5, type: 'highpass', fs: 44100 })
```

**Circuit**: Korg MS-10/MS-20 (1978)<br>
**Analysis**: Stilson & Smith (1996)[^12]; Zavalishin (2012)[^9], Ch. 5<br>
**vs Moog ladder**: 2-pole ($-12\,\text{dB/oct}$) vs 4-pole ($-24\,\text{dB/oct}$); Korg35 has complementary HP mode

![Korg35 LP and HP](plot/korg35.svg)


### Oberheim

Oberheim SEM (1974) — 2-pole state-variable filter with four modes from one circuit.

**Topology**: 2 trapezoidal integrators with nonlinear feedback; multimode output (LP/HP/BP/notch)<br>
**Response**: $-12\,\text{dB/oct}$; warm, musical resonance; continuous mode morphing<br>
**Implementation**: ZDF — Zavalishin (2012)[^9], Ch. 4–5; $\tanh$ saturation on integrator states

```js
import { oberheim } from 'audio-filter/analog'

oberheim(buffer, { fc: 1000, resonance: 0.5, type: 'lowpass',  fs: 44100 })
oberheim(buffer, { fc: 1000, resonance: 0.5, type: 'highpass', fs: 44100 })
oberheim(buffer, { fc: 1000, resonance: 0.5, type: 'bandpass', fs: 44100 })
oberheim(buffer, { fc: 1000, resonance: 0.5, type: 'notch',    fs: 44100 })
```

**Circuit**: Oberheim SEM (1974), Two Voice, Four Voice, Eight Voice<br>
**vs Moog/Korg**: 2-pole like Korg35 but true state-variable topology; LP/HP/BP/notch from one circuit; warmer resonance character

![Oberheim SEM](plot/oberheim.svg)


## Speech

Filters that model or process the human vocal tract — from vowel synthesis to spectral voice coding.


### Formant

Parallel resonator bank — each peak models one vocal tract resonance (formant).

**Model**: parallel combination of second-order resonators, each modeling one vocal tract mode<br>
**Formant frequencies**: determined by vocal tract shape; F1 controls vowel openness, F2 controls front/back<br>
**Typical ranges**: F1: 250–850 Hz, F2: 850–2500 Hz, F3: 1700–3500 Hz<br>
**Implementation**: uses `resonator` internally — constant peak-gain bandpass per formant<br>
**Defaults**: F1=730 Hz, F2=1090 Hz, F3=2440 Hz (open vowel /a/)

```js
import { formant } from 'audio-filter/speech'

formant(excitation, { fs: 44100 })   // vowel /a/ (default)

formant(excitation, {
  formants: [{ fc: 270, bw: 60, gain: 1 }, { fc: 2290, bw: 90, gain: 0.5 }],
  fs: 44100
})   // vowel /i/
```

**Use when**: speech synthesis, singing synthesis, vocal effects, acoustic phonetics<br>
**Not a substitute for**: LPC synthesis, which estimates formants automatically from a speech signal

![Formant filter](plot/formant.svg)


### Vocoder

Channel vocoder — transfers the spectral envelope of one sound onto the pitched content of another.

Note: takes two separate buffers, returns a new buffer (does not modify in-place).

**Principle**: analyze modulator into N bands → extract envelope per band → multiply with filtered carrier → sum<br>
**Implementation**: N parallel bandpass filters on both signals; envelope follower per modulator band<br>
**Band count**: 8 = robotic effect; 16 = classic vocoder sound; 32+ = more speech intelligibility

```js
import { vocoder } from 'audio-filter/speech'

// carrier: pitched source (sawtooth, buzz, noise...)
// modulator: signal whose spectral shape to impose (voice, instrument...)
let output = vocoder(carrier, modulator, { bands: 16, fs: 44100 })
```

**Inventor**: Dudley (1939)[^13], Bell Labs<br>
**Use when**: voice effects, talkbox simulation, cross-synthesis, spectral morphing


### LPC

Linear Predictive Coding — estimates the vocal tract transfer function from a speech signal.

**Analysis**: autocorrelation method + Levinson-Durbin recursion → LPC coefficients + residual<br>
**Synthesis**: all-pole filter reconstructs signal from residual excitation<br>
**Round-trip**: `lpcAnalysis` → `lpcSynthesize` recovers the original signal exactly

```js
import { lpcAnalysis, lpcSynthesize } from 'audio-filter/speech'

// Analysis: extract vocal tract model
let { coefs, gain, residual } = lpcAnalysis(speechFrame, { order: 12 })

// Synthesis: reconstruct from residual
lpcSynthesize(residual, { coefs, gain })   // residual → reconstructed speech

// Modify pitch: replace residual with different excitation
let buzz = generatePulseTrainAtNewPitch()
lpcSynthesize(buzz, { coefs, gain })       // speech at new pitch
```

**Origin**: Atal & Hanauer (1971)[^19]; foundation of CELP, GSM, and modern speech codecs<br>
**Use when**: speech coding, pitch modification, voice conversion, formant estimation, speech analysis

![LPC analysis/synthesis](plot/lpc.svg)


## EQ

Equalization and frequency routing — from parametric studio EQ to speaker crossover networks.


### Graphic EQ

10-band ISO octave equalizer — fixed center frequencies, gain per band.

**Implementation**: parallel biquad peaking filters, one per band; gains combined additively<br>
**Band spacing**: 1-octave intervals — $f_k = 1000 \cdot 2^k\,\text{Hz}$<br>
**Bands**: 31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz

```js
import { graphicEq } from 'audio-filter/eq'

graphicEq(buffer, {
  gains: { 125: -3, 1000: +6, 8000: +2 },
  fs: 44100
})
```

**Standard**: ISO 266:1997 center frequencies<br>
**Use when**: quick tonal shaping, DJ mixers, consumer audio, live sound<br>
**vs Parametric EQ**: fixed centers but simpler — no per-band frequency or Q control

![Graphic EQ](plot/graphic-eq.svg)


### Parametric EQ

N-band EQ with fully adjustable frequency, Q, and gain per band.

**Implementation**: cascaded biquad sections — one per band; `peak` uses peaking EQ biquad, shelves use Zölzer shelf design[^16]<br>
**Band types**: `peak` (bell curve at $f_c$), `lowshelf` (boost/cut below $f_c$), `highshelf` (boost/cut above $f_c$)

```js
import { parametricEq } from 'audio-filter/eq'

parametricEq(buffer, {
  bands: [
    { fc: 80,   Q: 0.7, gain: +4,  type: 'lowshelf'  },
    { fc: 1000, Q: 2.0, gain: -3,  type: 'peak'      },
    { fc: 8000, Q: 0.7, gain: +2,  type: 'highshelf' },
  ],
  fs: 44100
})
```

**Use when**: studio mixing, mastering, precise tonal correction<br>
**vs Graphic EQ**: fully adjustable $f_c$, Q, and gain per band; no fixed centers

![Parametric EQ](plot/parametric-eq.svg)


### Crossover

Linkwitz-Riley crossover network — splits audio into N frequency bands with flat magnitude sum.

**Filter type**: cascade of two Butterworth filters of half the specified order<br>
**Property**: LR4 (order=4) bands sum to flat magnitude response with correct phase alignment<br>
**Orders**: LR2 ($-12\,\text{dB/oct}$), LR4 ($-24\,\text{dB/oct}$, most common), LR8 ($-48\,\text{dB/oct}$)<br>
**Returns**: `SOS[][]` — one SOS array per band

```js
import { crossover } from 'audio-filter/eq'
import { filter } from 'digital-filter'

let bands = crossover([500, 5000], 4, 44100)   // 3 bands: lo / mid / hi

let lo  = Float64Array.from(buffer); filter(lo,  { coefs: bands[0] })
let mid = Float64Array.from(buffer); filter(mid, { coefs: bands[1] })
let hi  = Float64Array.from(buffer); filter(hi,  { coefs: bands[2] })
```

**Designers**: Linkwitz & Riley (1976)[^14]<br>
**Use when**: speaker system design, multi-band dynamics, band splitting for separate processing

![4-way crossover](plot/crossover.svg)


### Crossfeed

Headphone crossfeed — mixes a filtered copy of each channel into the other to reduce in-head localization.

Takes two separate channel buffers, modifies both in-place.

**Problem**: speaker playback has inter-channel crosstalk and head shadowing; headphones remove these, causing an unnatural "in-head" stereo image<br>
**Solution**: add a lowpass-filtered, attenuated copy of each channel to the opposite channel, simulating crosstalk and head diffraction<br>
**fc**: models the head-shadow lowpass (~700 Hz is typical); **level**: 0.3 = mild, 0.5 = strong

```js
import { crossfeed } from 'audio-filter/eq'

crossfeed(left, right, { fc: 700, level: 0.3, fs: 44100 })
```

**Origin**: Bauer (1961)[^15]; BS2B (Bauer Stereophonic-to-Binaural) algorithm

![Crossfeed](plot/crossfeed.svg)


## Effect

Signal processing utilities — conditioning, shaping, and analyzing audio signals.


### DC blocker

Removes DC offset — the simplest useful filter.

$H(z) = \dfrac{1 - z^{-1}}{1 - Rz^{-1}}$

**Topology**: zero at $z = 1$ (DC), pole at $z = R$<br>
**Cutoff**: $f_c \approx \frac{(1-R) f_s}{2\pi}$ — $R = 0.995$ gives ~22 Hz at 44.1 kHz

```js
import { dcBlocker } from 'audio-filter/effect'

let params = { R: 0.995 }
dcBlocker(buffer, params)
```

**Use when**: removing DC bias before processing, preventing lowpass filter saturation

![DC blocker](plot/dc-blocker.svg)


### Comb filter

Adds a delayed copy of the signal to itself — notches and peaks at harmonics of $f_s / D$.

**Feedforward**: $H(z) = 1 + g \cdot z^{-D}$ — notches at $f = \frac{(2k+1) f_s}{2D}$<br>
**Feedback**: $H(z) = \dfrac{1}{1 - g \cdot z^{-D}}$ — peaks at $f = \frac{k \cdot f_s}{D}$

```js
import { comb } from 'audio-filter/effect'

comb(buffer, { delay: 100, gain: 0.6, type: 'feedback' })
```

**Use when**: flanging, chorus (with modulated delay), Karplus-Strong string synthesis, room mode modeling

![Comb filter](plot/comb.svg)


### Allpass

Unity magnitude at all frequencies — shifts phase only. First and second order.

**First order**: $H(z) = \dfrac{a + z^{-1}}{1 + a z^{-1}}$ — pole at $z = -a$, 180° phase shift at Nyquist<br>
**Second order**: $H(z) = \dfrac{d - 2R\cos(\omega_0)z^{-1} + R^2 z^{-2}}{1 - 2R\cos(\omega_0)z^{-1} + R^2 z^{-2}}$ — 360° phase shift around $\omega_0$

```js
import { allpass } from 'audio-filter/effect'

allpass.first(buffer, { a: 0.5 })                          // coefficient a
allpass.second(buffer, { fc: 1000, Q: 1, fs: 44100 })      // center fc, quality Q
```

**Use when**: phase equalization, reverb building blocks (Schroeder reverb), stereo widening

![Allpass 2nd order](plot/allpass.svg)


### Pre-emphasis / de-emphasis

First-order highpass (emphasis) and its inverse (de-emphasis) — used before and after coding or transmission.

$H(z) = 1 - \alpha z^{-1}$ (emphasis) &nbsp;/&nbsp; $H(z) = \dfrac{1}{1 - \alpha z^{-1}}$ (de-emphasis)

**Rolloff**: emphasis boosts above $f_c = \frac{(1-\alpha) f_s}{2\pi}$ — $\alpha = 0.97$ gives ~420 Hz at 44.1 kHz<br>
**Inverse pair**: `deemphasis` exactly cancels `emphasis` — $H_e(z) \cdot H_d(z) = 1$

```js
import { emphasis, deemphasis } from 'audio-filter/effect'

emphasis(buffer, { alpha: 0.97 })    // before encoding
deemphasis(buffer, { alpha: 0.97 })  // after decoding — exact inverse
```

**Use when**: speech coding (GSM, AMR uses $\alpha = 0.97$), tape recording, FM broadcasting

![Pre-emphasis](plot/emphasis.svg)


### Resonator

Constant peak-gain bandpass — peak amplitude stays fixed regardless of bandwidth.

$H(z) = \dfrac{1 - R^2}{1 - 2R\cos(\omega_0)z^{-1} + R^2 z^{-2}}$

**Pole radius**: $R = e^{-\pi \cdot bw / f_s}$ — controls bandwidth; $bw \to 0$ gives infinite Q<br>
**Peak gain**: always 0 dB by construction — $(1 - R^2)$ normalizes the peak

```js
import { resonator } from 'audio-filter/effect'

resonator(buffer, { fc: 440, bw: 20, fs: 44100 })
```

**Use when**: additive synthesis (bells, gongs), modal synthesis, formant bank building<br>
**vs Peaking EQ**: resonator has fixed 0 dB peak; peaking EQ has variable gain — use resonator for synthesis, EQ for mixing

![Resonator](plot/resonator.svg)


### Envelope follower

Tracks the instantaneous amplitude of a signal with configurable attack and release.

**Attack**: $y[n] = \alpha_A \cdot y[n{-}1] + (1-\alpha_A)|x[n]|$ when $|x[n]| > y[n{-}1]$<br>
**Release**: $y[n] = \alpha_R \cdot y[n{-}1]$ when $|x[n]| \leq y[n{-}1]$<br>
**Time constants**: $\alpha = e^{-1/(\tau f_s)}$ — converts seconds to pole radius

```js
import { envelope } from 'audio-filter/effect'

let params = { attack: 0.001, release: 0.05, fs: 44100 }
envelope(buffer, params)   // buffer replaced with envelope signal (0–1)
```

**Use when**: compressor/limiter sidechain, auto-wah, ducking, VCA control, gain riding

![Envelope follower](plot/envelope.svg)


### Slew limiter

Limits the rate of change — limits rise and fall rates separately.

**Operation**: clips the per-sample derivative — $\Delta y \leq \text{rise}/f_s$ and $\Delta y \geq -\text{fall}/f_s$<br>
**Nonlinear**: not a linear filter — frequency response depends on signal amplitude

```js
import { slewLimiter } from 'audio-filter/effect'

slewLimiter(buffer, { rise: 500, fall: 200, fs: 44100 })
```

**Use when**: smoothing control signals and automation, click prevention, portamento/glide, analog CV emulation

![Slew limiter](plot/slew-limiter.svg)


### Noise shaping

Error-feedback dithering — quantizes to N bits while shaping quantization noise into high frequencies.

**Principle**: $y[n] = Q(x[n] + e_\text{shaped}[n])$ — quantization error fed back through shaping filter<br>
**Default filter**: first-order highpass $H(z) = 1 - z^{-1}$ — pushes noise toward Nyquist<br>
**Gain**: noise shaping trades total noise power for spectral placement; audible band gets quieter

```js
import { noiseShaping } from 'audio-filter/effect'

noiseShaping(buffer, { bits: 16 })   // dither to 16-bit, noise shaped above 10 kHz
```

**Use when**: dithering before bit-depth reduction, CD mastering, 16-bit export from 32-bit float<br>
**Reference**: Lipshitz, Wannamaker & Vanderkooy (1992)[^17]

![Noise shaping](plot/noise-shaping.svg)


### Pink noise

Shapes white noise to $1/f$ spectrum — equal energy per octave.

**Spectrum**: power spectral density $S(f) \propto 1/f$ — $-3\,\text{dB/oct}$ slope, equal energy per octave<br>
**Implementation**: Voss-McCartney algorithm — sum of white noise sources at octave-spaced update rates; approximated by cascaded first-order IIR filters

```js
import { pinkNoise } from 'audio-filter/effect'

let buf = new Float64Array(1024)
for (let i = 0; i < buf.length; i++) buf[i] = Math.random() * 2 - 1
pinkNoise(buf, {})   // white → pink (−3 dB/oct spectral slope)
```

**Use when**: noise testing, psychoacoustic masking reference, procedural audio, natural-sounding noise<br>
**vs White noise**: white noise has equal energy per Hz ($-0\,\text{dB/oct}$); pink is perceptually flat

![Pink noise filter](plot/pink-noise.svg)


### Spectral tilt

Applies a constant dB/octave slope — tilts the entire spectrum.

**Model**: first-order IIR approximation of fractional power-law spectrum $S(f) \propto f^\alpha$<br>
**slope**: $\alpha = -3\,\text{dB/oct}$ gives pink noise character; $-6\,\text{dB/oct}$ gives brownian/red noise

```js
import { spectralTilt } from 'audio-filter/effect'

spectralTilt(buffer, { slope: -3, fs: 44100 })   // −3 dB/oct: brownian noise character
spectralTilt(buffer, { slope: +3, fs: 44100 })   // +3 dB/oct: pre-emphasis for coding
```

**Use when**: matching microphone/speaker frequency responses, spectral coloring, noise synthesis

![Spectral tilt](plot/spectral-tilt.svg)


### Variable bandwidth

Lowpass with continuously variable bandwidth — smooth parameter automation without discontinuities.

**Implementation**: biquad lowpass with per-sample coefficient update using smooth interpolation<br>
**Property**: no discontinuity when $f_c$ or $Q$ change — avoids clicks from abrupt coefficient jumps

```js
import { variableBandwidth } from 'audio-filter/effect'

variableBandwidth(buffer, { fc: 2000, Q: 1.0, fs: 44100 })
```

**Use when**: LFO-modulated filter cutoff, automated EQ sweeps, smooth filter animation<br>
**vs Direct biquad**: recalculating biquad coefficients per sample causes zipper noise; variable bandwidth avoids this

![Variable bandwidth](plot/variable-bandwidth.svg)


### Phaser

Cascade of swept allpass filters — creates moving notches and peaks across the spectrum.

**Implementation**: N first-order allpass stages with LFO-modulated coefficients; feedback from output to input<br>
**Effect**: notch frequencies sweep together as LFO moves; even stages = peaks align with notches for deep effect<br>
**Character**: 4 stages = subtle; 6–8 = classic; 12 = extreme; feedback adds resonant peaks at notches

```js
import { phaser } from 'audio-filter/effect'

phaser(buffer, { rate: 0.5, depth: 0.7, stages: 4, feedback: 0.5, fc: 1000, fs: 44100 })
```

**Use when**: guitar effects, synth pads, psychedelic textures, stereo animation

![Phaser](plot/phaser.svg)


### Flanger

Modulated short delay with feedback — metallic, jet-engine-like sweeping.

**Implementation**: delay line (1–10 ms) with LFO-modulated delay time; linear interpolation for fractional samples<br>
**Effect**: comb filter with moving notches/peaks; feedback intensifies the comb effect<br>
**vs Chorus**: shorter delay (1–10 ms vs 20–50 ms), feedback creates resonant comb pattern

```js
import { flanger } from 'audio-filter/effect'

flanger(buffer, { rate: 0.3, depth: 0.7, delay: 3, feedback: 0.5, fs: 44100 })
```

**Use when**: guitar/synth effects, jet sweep sounds, metallic textures

![Flanger](plot/flanger.svg)


### Chorus

Multiple detuned delay lines — ensemble thickening and stereo width.

**Implementation**: N voices with phase-spread LFOs modulating separate delay taps; averaged and mixed with dry signal<br>
**Effect**: each voice is slightly detuned from the original, creating a rich ensemble sound<br>
**Voices**: 2 = subtle doubling; 3 = classic chorus; 5+ = thick ensemble/string effect

```js
import { chorus } from 'audio-filter/effect'

chorus(buffer, { rate: 1.5, depth: 0.5, delay: 20, voices: 3, fs: 44100 })
```

**Use when**: thickening vocals/guitars, string ensemble effect, stereo widening, detuned pads

![Chorus](plot/chorus.svg)


### Wah

Swept resonant bandpass — the classic guitar pedal effect.

**Implementation**: state-variable filter bandpass with LFO or manual frequency control; logarithmic sweep range<br>
**Sweep range**: $f_c \cdot 2^{-\text{depth}}$ to $f_c \cdot 2^{+\text{depth}}$ — centered on `fc`<br>
**Modes**: `auto` = LFO-driven sweep; `manual` = fixed frequency (for envelope-controlled wah, set `fc` per block)

```js
import { wah } from 'audio-filter/effect'

wah(buffer, { rate: 1.5, depth: 0.8, fc: 1000, Q: 5, fs: 44100 })           // auto-wah
wah(buffer, { mode: 'manual', fc: envelopeValue * 3000, Q: 5, fs: 44100 })   // envelope-controlled
```

**Use when**: guitar wah pedal, auto-wah, funky bass, filter sweeps

![Wah](plot/wah.svg)


## Filter selection guide

| I need to... | Use |
|---|---|
| Measure SPL or noise level | `aWeighting` (general), `cWeighting` (peak), `itu468` (broadcast noise) |
| Measure loudness (LUFS/LU) | `kWeighting` |
| Decode vinyl audio | `riaa` |
| Model the cochlea / auditory system | `gammatone`, `erbBank` |
| Analyze a spectrum in octave bands | `octaveBank` |
| Psychoacoustic analysis / masking model | `barkBank` |
| MFCC / speech recognition features | `melBank` |
| Synth filter — warmth and resonance | `moogLadder` |
| Synth filter — acid / squelch | `diodeLadder` |
| Synth filter — 2-pole LP + HP | `korg35` |
| Synth filter — multimode SVF | `oberheim` |
| Synthesize vowel sounds | `formant` |
| Transfer one sound's spectral shape to another | `vocoder` |
| Analyze/resynthesize speech, change pitch | `lpcAnalysis` / `lpcSynthesize` |
| Studio EQ at fixed ISO frequencies | `graphicEq` |
| Studio EQ with full per-band control | `parametricEq` |
| Split audio for multi-way speakers | `crossover` |
| Improve headphone stereo imaging | `crossfeed` |
| Remove DC offset | `dcBlocker` |
| Create flanging / resonant combing | `comb` |
| Phase-shift without changing magnitude | `allpass.first`, `allpass.second` |
| Pre-process for audio coding | `emphasis` / `deemphasis` |
| Modal synthesis (bells, drums, rooms) | `resonator` |
| Track signal amplitude | `envelope` |
| Smooth a control signal | `slewLimiter` |
| Dither for bit-depth reduction | `noiseShaping` |
| Generate pink / brown noise | `pinkNoise` + `spectralTilt` |
| Tilt spectrum for tone shaping | `spectralTilt` |
| Sweeping notch/peak effect | `phaser` |
| Metallic jet-sweep effect | `flanger` |
| Ensemble thickening | `chorus` |
| Swept bandpass pedal effect | `wah` |


## FAQ

**Why does my filter click when I change `fc` or `resonance`?**
Biquad coefficients change discontinuously between samples. Use `variableBandwidth` for smooth automated sweeps, or crossfade.

**Why does my Moog/Diode filter blow up?**
`resonance=1` on Moog is intentional self-oscillation. Diode ladder is stable up to 0.95. Limit input gain before high resonance.

**Does mutating `params` between calls reset state?**
No — mutating the same object (`params.fc = newFc`) preserves state. Replacing the object (`params = { fc: newFc }`) loses it.

**Why does `.coefs(fs)` return an SOS array instead of one biquad?**
A-weighting needs 3 second-order sections; a single biquad can't represent a 6-pole response. Pass SOS arrays to `digital-filter`'s `filter()` or `freqz()`.

**What sample rate should I use for accurate A-weighting?**
96 kHz for IEC Class 1 across the full 20 Hz–20 kHz range. At 48 kHz error grows above 10 kHz (~1 dB at 10 kHz, ~4 dB at 20 kHz).


## Recipes

**Chain filters**
```js
let p1 = { fc: 200, fs: 44100 }
let p2 = { R: 0.995 }
for (let buf of stream) {
  dcBlocker(buf, p2)   // DC removal first
  moogLadder(buf, p1)
}
```

**Stereo — independent state per channel**
```js
let pL = { fc: 1000, fs: 44100 }
let pR = { fc: 1000, fs: 44100 }
for (let [L, R] of stereoStream) {
  moogLadder(L, pL)
  moogLadder(R, pR)
}
```

**Frequency analysis**
```js
import { freqz, mag2db } from 'digital-filter'

let sos = aWeighting.coefs(44100)
let { magnitude } = freqz(sos, 4096, 44100)
let db = mag2db(magnitude)   // dB at 4096 frequencies, 20 Hz–Nyquist
```

**Multi-band split**
```js
let bands = crossover([500, 5000], 4, 44100)   // lo / mid / hi
let [lo, mid, hi] = bands.map(coefs => {
  let buf = Float64Array.from(input)   // copy — filter is in-place
  filter(buf, { coefs })
  return buf
})
// process independently, then sum
```

**Automate cutoff without clicks**
```js
let p = { fc: 200, Q: 1.0, fs: 44100 }
for (let buf of stream) {
  p.fc = 200 + lfo() * 1800   // mutate in-place — state preserved
  variableBandwidth(buf, p)
}
```


## Pitfalls

**New params object on every call — state resets each block**
```js
// Wrong
for (let buf of stream) moogLadder(buf, { fc: 1000, fs: 44100 })

// Right — create once, reuse
let p = { fc: 1000, fs: 44100 }
for (let buf of stream) moogLadder(buf, p)
```

**Shared params for stereo — channels corrupt each other's state**
```js
// Wrong
let p = { fc: 1000, fs: 44100 }
for (let [L, R] of stream) { moogLadder(L, p); moogLadder(R, p) }

// Right — one object per channel
let pL = { fc: 1000, fs: 44100 }, pR = { fc: 1000, fs: 44100 }
for (let [L, R] of stream) { moogLadder(L, pL); moogLadder(R, pR) }
```

**Filtering the same buffer twice for multi-band — second band sees pre-filtered input**
```js
// Wrong
filter(buffer, { coefs: bands[0] })
filter(buffer, { coefs: bands[1] })   // input already filtered!

// Right — copy per band
let bufs = bands.map(b => { let c = Float64Array.from(buffer); filter(c, { coefs: b.coefs }); return c })
```

**Omitting `fs` — silently uses 44100 Hz math on 48000 Hz audio**
```js
// Wrong — wrong cutoffs at 48 kHz
moogLadder(buffer, { fc: 1000 })

// Right
moogLadder(buffer, { fc: 1000, fs: 48000 })
```


## See also

- [digital-filter](https://github.com/audiojs/digital-filter) — general-purpose filter design: Butterworth, Chebyshev, Bessel, Elliptic, FIR, and more
- [audio-decode](https://github.com/audiojs/audio-decode) — decode audio files to PCM buffers
- [audio-speaker](https://github.com/audiojs/audio-speaker) — output PCM audio to system speakers
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — browser built-in audio; basic biquad shapes only, requires `AudioContext`



[^1]: IEC 61672-1:2013, *Electroacoustics — Sound level meters — Part 1: Specifications*. Supersedes IEC 651:1979.

[^2]: ITU-R BS.1770-4:2015, *Algorithms to measure audio programme loudness and true-peak audio level*. Adopted by EBU R128.

[^3]: ITU-R BS.468-4:1986, *Measurement of audio-frequency noise voltage level in sound broadcasting*. Originally CCIR 468, 1968.

[^4]: RIAA standard (1954); IEC 60098:1987, *Analogue audio disk records and reproducing equipment*.

[^5]: Patterson, R.D., Robinson, K., Holdsworth, J., McKeown, D., Zhang, C. & Allerhand, M. (1992). "Complex sounds and auditory images." *Auditory Physiology and Perception*, Pergamon, pp. 429–446.

[^6]: IEC 61260-1:2014, *Electroacoustics — Octave-band and fractional-octave-band filters — Part 1: Specifications*. ANSI S1.11:2004.

[^7]: Moore, B.C.J. & Glasberg, B.R. (1983). "Suggested formulae for calculating auditory-filter bandwidths and excitation patterns." *JASA* 74(3), pp. 750–753. Updated 1990.

[^8]: Zwicker, E. (1961). "Subdivision of the audible frequency range into critical bands." *JASA* 33(2), p. 248.

[^9]: Zavalishin, V. (2012). *The Art of VA Filter Design*. Native Instruments.

[^10]: Moog, R.A. (1965). *Voltage controlled electronic music modules*. Patent US3475623.

[^11]: Pirkle, W.C. (2019). *Designing Audio Effect Plugins in C++*, 2nd ed. Routledge.

[^12]: Stilson, T. & Smith, J.O. (1996). "Analyzing the Moog VCF with considerations for digital implementation." *Proc. ICMC*.

[^13]: Dudley, H. (1939). "The vocoder." *Bell Laboratories Record* 17, pp. 122–126. Patent US2151091.

[^14]: Linkwitz, S. & Riley, R. (1976). "Active Crossover Networks for Non-Coincident Drivers." *JAES* 24(1), pp. 2–8.

[^15]: Bauer, B.B. (1961). "Stereophonic Earphones and Binaural Loudspeakers." *JAES* 9(2), pp. 148–151.

[^16]: Zölzer, U. (2011). *DAFX: Digital Audio Effects*, 2nd ed. Wiley.

[^17]: Lipshitz, S.P., Wannamaker, R.A. & Vanderkooy, J. (1992). "Quantization and Dither: A Theoretical Survey." *JAES* 40(5), pp. 355–375.

[^18]: O'Shaughnessy, D. (2000). *Speech Communications: Human and Machine*, 2nd ed. IEEE Press.

[^19]: Atal, B.S. & Hanauer, S.L. (1971). "Speech Analysis and Synthesis by Linear Prediction of the Speech Wave." *JASA* 50(2B), pp. 637–655.
