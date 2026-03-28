# audio-filter

Canonical audio filters implementations.<br>
Covering
[weighting](#weighting), [auditory](#auditory), [analog](#analog), [speech](#speech), [eq](#eq), [effect](#effect) domains.

## Install

```
npm install audio-filter
```

```js
// import everything
import * as filter from 'audio-filter'

// import individually
import aWeighting from 'audio-filter/weighting/a-weighting.js'
import gammatone from 'audio-filter/auditory/gammatone.js'
import korg35 from 'audio-filter/analog/korg35.js'
import vocoder from 'audio-filter/speech/vocoder.js'
import graphicEq from 'audio-filter/eq/graphic-eq.js'
import comb from 'audio-filter/effect/comb.js'
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

![A-weighting](plot/a-weighting.svg)

```js
import { aWeighting } from 'audio-filter/weighting'

let p = { fs: 44100 }
for (let buf of stream) aWeighting(buf, p)   // A-weighted stream
```

<details>
<summary>Reference</summary>

**Standard**: IEC 61672-1:2013[^1]

**Transfer function**: H(s) = K·s⁴ / ((s+ω₁)²·(s+ω₂)·(s+ω₃)·(s+ω₄)²)

**Poles**: ω₁=2π·20.6 Hz, ω₂=2π·107.7 Hz, ω₃=2π·737.9 Hz, ω₄=2π·12194 Hz

**Implementation**: bilinear transform of analog prototype, prewarped poles, 3 SOS sections

**Normalization**: 0 dB at 1 kHz (IEC requirement)

**Use when**: measuring SPL, noise, OSHA compliance, audio quality

**Not for**: loudness in broadcast (use K-weighting), noise annoyance (use ITU-468)

</details>


### C-weighting

Like A-weighting but flatter — less rolloff at low and high frequencies.

![C-weighting](plot/c-weighting.svg)

```js
cWeighting(buffer, { fs: 44100 })
```

<details>
<summary>Reference</summary>

**Standard**: IEC 61672-1:2013[^1]

**Transfer function**: H(s) = K·s² / ((s+ω₁)²·(s+ω₄)²)

**Poles**: ω₁=2π·20.6 Hz, ω₄=2π·12194 Hz (same as A-weighting outer poles)

**Implementation**: 2 SOS sections, bilinear transform

**Use when**: peak sound level measurement, where A-weighting over-penalizes bass

**Compared to A**: rolls off below 31.5 Hz and above 8 kHz; flat 31.5 Hz–8 kHz

</details>


### K-weighting

The loudness measurement curve — a high shelf plus a highpass. Used to compute LUFS.

![K-weighting](plot/k-weighting.svg)

```js
import { kWeighting } from 'audio-filter/weighting'

kWeighting(buffer, { fs: 48000 })   // exact ITU-R BS.1770 coefficients
kWeighting(buffer, { fs: 44100 })   // approximated via biquad design
```

<details>
<summary>Reference</summary>

**Standard**: ITU-R BS.1770-4:2015[^2], EBU R128

**Stage 1**: pre-filter — high shelf +4 dB above ~1.5 kHz (head diffraction simulation)

**Stage 2**: RLB highpass — 2nd-order Butterworth at ~38 Hz (removes sub-bass)

**Exact coefficients at 48 kHz**: specified in BS.1770 Annex 1; this implementation uses them verbatim

**Use when**: computing integrated loudness (LUFS/LKFS), broadcast loudness normalization

**Not for**: A-weighted SPL measurement (different shape, different standard)

</details>


### ITU-R 468

Peaked noise weighting — peaks at +12.2 dB near 6.3 kHz — models how humans actually perceive noise annoyance.

![ITU-R 468](plot/itu468.svg)

```js
itu468(buffer, { fs: 48000 })
```

<details>
<summary>Reference</summary>

**Standard**: ITU-R BS.468-4:1986[^3] (original CCIR 468, 1968)

**Shape**: rises steeply from 31.5 Hz, peaks at +12.2 dB at 6.3 kHz, rolls off above 10 kHz

**Rationale**: human hearing is more sensitive to short noise bursts than sine tones; 468 weights accordingly

**Implementation**: practical IIR approximation via cascaded biquads, within ~1 dB of spec

**Use when**: measuring noise in broadcast equipment, tape noise, hum and hiss

**Compared to A-weighting**: 6.3 kHz peak makes it harsher on hiss; preferred in European broadcast

</details>


### RIAA

Playback equalization for vinyl records — a shelving curve with three time constants.

![RIAA equalization](plot/riaa.svg)

```js
import { riaa } from 'audio-filter/weighting'

riaa(phonoSignal, { fs: 44100 })   // correct vinyl playback
```

<details>
<summary>Reference</summary>

**Standard**: RIAA 1954, IEC 60098:1987[^4]

**Time constants**: T₁=3180 μs (50.05 Hz pole), T₂=318 μs (500.5 Hz zero), T₃=75 μs (2122 Hz pole)

**Transfer function**: H(s) = (1 + s·T₂) / ((1 + s·T₁)(1 + s·T₃))

**Purpose**: playback de-emphasis undoes the mastering pre-emphasis applied during vinyl cutting

**Shape**: boosts bass ~+20 dB at 20 Hz, rolls off treble; at playback restores flat response

**Implementation**: 1 SOS section via bilinear transform, normalized 0 dB at 1 kHz

</details>


## Auditory

Models of the human auditory system — how the cochlea and brain decompose sound into frequency channels. Used in psychoacoustics, music information retrieval, and hearing aid design.


### Gammatone

The cochlear filter — bandpass tuned to one frequency, decaying oscillation, mimics an inner hair cell.

![Gammatone filter](plot/gammatone.svg)

```js
import { gammatone } from 'audio-filter/auditory'

let params = { fc: 1000, fs: 44100 }
gammatone(buffer, params)   // bandpass at 1 kHz with cochlear envelope
```

Reuse `params` across blocks — state in `params._s`, gain cached in `params._gain`.

![Gammatone bank (6 center frequencies)](plot/gammatone-bank.svg)

<details>
<summary>Reference</summary>

**Origin**: Patterson et al. (1992)[^5]

**Model**: cascade of complex one-pole filters; 4th-order is the standard cochlear approximation

**Bandwidth**: ERB = 24.7·(4.37·fc/1000 + 1) Hz

**Implementation**: complex resonator with gain normalization to 0 dB at fc

**Use when**: cochlear modeling, auditory scene analysis, psychoacoustic feature extraction

**Compared to Butterworth bandpass**: gammatone has asymmetric temporal envelope matching biological data

</details>


### Octave bank

ISO/IEC fractional-octave filter bank — the standard for acoustic measurement and spectrum analysis.

![1/3-octave filter bank](plot/octave-bank.svg)

**Returns** array of `{ fc, coefs }` — each band is a biquad bandpass section.

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

<details>
<summary>Reference</summary>

**Standard**: IEC 61260-1:2014[^6], ANSI S1.11:2004

**Center frequencies**: ISO 266 series — fc = 1000·G^(k/fraction), G = 10^(3/10)

**Bandwidth**: each band spans fc·G^(−1/2n) to fc·G^(+1/2n)

**1/1 octave**: 10 bands (31.5–16 kHz) — coarse; **1/3 octave**: 30 bands — standard; **1/6+**: psychoacoustics

**Use when**: acoustic measurement, noise assessment, spectrum visualization

</details>


### ERB bank

Equivalent Rectangular Bandwidth scale — how the auditory system actually spaces its channels.

![ERB filter bank](plot/erb-bank.svg)

**Returns** array of `{ fc, erb, bw }` descriptors. Apply `gammatone` at each `fc` for the filter bank.

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

<details>
<summary>Reference</summary>

**Origin**: Moore & Glasberg (1983, 1990)[^7]

**ERB formula**: ERB(fc) = 24.7·(4.37·fc/1000 + 1)

**Spacing**: ~1 ERB between adjacent channels — logarithmic above 1 kHz, more linear below

**Use when**: speech processing, hearing models, auditory feature extraction

**Compared to Bark**: ERB is more accurate above 500 Hz; Bark is the psychoacoustic masking model

</details>


### Bark bank

Zwicker's 24 critical bands — the psychoacoustic foundation of perceptual audio coding.

![Bark critical band filter bank](plot/bark-bank.svg)

**Returns** array of `{ bark, fLow, fHigh, fc, coefs }` — each band is a biquad bandpass section.

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

<details>
<summary>Reference</summary>

**Origin**: Zwicker (1961)[^8]

**Scale**: 24 bands spanning 20 Hz–20 kHz; named after Heinrich Barkhausen

**Band widths**: ~100 Hz wide below 500 Hz; ~20% of center frequency above

**Use when**: perceptual audio coding (MP3/AAC use Bark-like groupings), loudness models, masking

**Compared to ERB**: Bark bands are wider and fewer; ERB is more accurate for hearing science

</details>


## Analog

Discrete-time models of analog circuits — each named after the hardware it replicates. Nonlinear, stateful, process in-place. The filters in synthesizers.


### Moog ladder

Robert Moog's 4-pole transistor ladder, 1965 — the most imitated filter in electronic music.

![Moog ladder resonance sweep](plot/moog-ladder.svg)

```js
import { moogLadder } from 'audio-filter/analog'

let params = { fc: 800, resonance: 0.7, fs: 44100 }
moogLadder(buffer, params)

// Self-oscillation — runs indefinitely from a single impulse
let silent = new Float64Array(4096); silent[0] = 0.01
moogLadder(silent, { fc: 1000, resonance: 1, fs: 44100 })
```

<details>
<summary>Reference</summary>

**Patent**: Moog (1965) US3475623[^10]

**Circuit**: 4 cascaded one-pole transistor ladder sections, global feedback from output to input

**Implementation**: Zero-delay feedback (ZDF) via trapezoidal integration — Zavalishin (2012)[^9], Ch. 6

**Response**: −24 dB/octave lowpass; resonance peak at fc; self-oscillation (sine wave) at resonance=1

**Nonlinearity**: tanh saturation at input (transistor ladder characteristic)

**vs Diode ladder**: Moog saturates only at input; diode saturates at each stage — different character at high resonance

</details>


### Diode ladder

Roland TB-303 / EMS VCS3 style — per-stage saturation gives the characteristic acid "squelch".

![Diode ladder](plot/diode-ladder.svg)

```js
import { diodeLadder } from 'audio-filter/analog'

let params = { fc: 500, resonance: 0.8, fs: 44100 }
diodeLadder(buffer, params)
```

<details>
<summary>Reference</summary>

**Circuit**: Roland TB-303, EMS VCS3, EDP Wasp

**Key difference from Moog**: tanh nonlinearity at each of 4 stages, not just input; feedback is a weighted sum of all stage outputs

**Character**: preserves bass at high resonance; more "squelchy" and aggressive than Moog

**Implementation**: ZDF — Zavalishin (2012)[^9]; Pirkle (2019)[^11], Ch. 10

**Stability**: stable up to resonance=0.95; bounded output

</details>


### Korg35

Korg MS-10/MS-20, 1978 — 2-pole filter with lowpass and complementary highpass outputs.

![Korg35 LP and HP](plot/korg35.svg)

```js
import { korg35 } from 'audio-filter/analog'

korg35(buffer, { fc: 1000, resonance: 0.5, type: 'lowpass',  fs: 44100 })
korg35(buffer, { fc: 1000, resonance: 0.5, type: 'highpass', fs: 44100 })
```

<details>
<summary>Reference</summary>

**Circuit**: Korg MS-10/MS-20 (1978)

**Topology**: 2 cascaded one-pole sections with nonlinear feedback; HP = input − LP

**Analysis**: Stilson & Smith (1996)[^12]; Zavalishin (2012)[^9], Ch. 5

**Character**: −12 dB/octave; aggressive resonance due to nonlinear feedback; both LP and HP from one circuit

**vs Moog ladder**: 2-pole (−12 dB/oct) vs 4-pole (−24 dB/oct); Korg35 has complementary HP mode

</details>


## Speech

Filters that model or process the human vocal tract — from vowel synthesis to spectral voice coding.


### Formant

Parallel resonator bank — each peak models one vocal tract resonance (formant).

![Formant filter](plot/formant.svg)

Defaults: F1=730 Hz, F2=1090 Hz, F3=2440 Hz (open vowel /a/).

```js
import { formant } from 'audio-filter/speech'

formant(excitation, { fs: 44100 })   // vowel /a/ (default)

formant(excitation, {
  formants: [{ fc: 270, bw: 60, gain: 1 }, { fc: 2290, bw: 90, gain: 0.5 }],
  fs: 44100
})   // vowel /i/
```

<details>
<summary>Reference</summary>

**Model**: parallel combination of second-order resonators, each modeling one vocal tract mode

**Formant frequencies**: determined by vocal tract shape; F1 controls vowel openness, F2 controls front/back

**Typical ranges**: F1: 250–850 Hz, F2: 850–2500 Hz, F3: 1700–3500 Hz

**Implementation**: uses `resonator` internally — constant peak-gain bandpass per formant

**Use when**: speech synthesis, singing synthesis, vocal effects, acoustic phonetics

**Not a substitute for**: LPC synthesis, which estimates formants automatically from a speech signal

</details>


### Vocoder

Channel vocoder — transfers the spectral envelope of one sound onto the pitched content of another.

Note: takes two separate buffers, returns a new buffer (does not modify in-place).

```js
import { vocoder } from 'audio-filter/speech'

// carrier: pitched source (sawtooth, buzz, noise...)
// modulator: signal whose spectral shape to impose (voice, instrument...)
let output = vocoder(carrier, modulator, { bands: 16, fs: 44100 })
```

<details>
<summary>Reference</summary>

**Inventor**: Dudley (1939)[^13], Bell Labs

**Principle**: analyze modulator into N bands → extract envelope per band → multiply with filtered carrier → sum

**Implementation**: N parallel bandpass filters on both signals; envelope follower per modulator band

**Band count**: 8 = robotic effect; 16 = classic vocoder sound; 32+ = more speech intelligibility

**Use when**: voice effects, talkbox simulation, cross-synthesis, spectral morphing

</details>


## EQ

Equalization and frequency routing — from parametric studio EQ to speaker crossover networks.


### Graphic EQ

10-band ISO octave equalizer — fixed center frequencies, gain per band.

![Graphic EQ](plot/graphic-eq.svg)

Bands: 31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz.

```js
import { graphicEq } from 'audio-filter/eq'

graphicEq(buffer, {
  gains: { 125: -3, 1000: +6, 8000: +2 },
  fs: 44100
})
```


### Parametric EQ

N-band EQ with fully adjustable frequency, Q, and gain per band.

![Parametric EQ](plot/parametric-eq.svg)

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


### Crossover

Linkwitz-Riley crossover network — splits audio into N frequency bands with flat magnitude sum.

![4-way crossover](plot/crossover.svg)

**Returns** `SOS[][]` — one SOS array per band.

```js
import { crossover } from 'audio-filter/eq'
import { filter } from 'digital-filter'

let bands = crossover([500, 5000], 4, 44100)   // 3 bands: lo / mid / hi

let lo  = Float64Array.from(buffer); filter(lo,  { coefs: bands[0] })
let mid = Float64Array.from(buffer); filter(mid, { coefs: bands[1] })
let hi  = Float64Array.from(buffer); filter(hi,  { coefs: bands[2] })
```

<details>
<summary>Reference</summary>

**Designers**: Linkwitz & Riley (1976)[^14]

**Filter type**: cascade of two Butterworth filters of half the specified order

**Property**: LR4 (order=4) bands sum to flat magnitude response with correct phase alignment

**Orders**: LR2 (−12 dB/oct), LR4 (−24 dB/oct, most common), LR8 (−48 dB/oct)

**Use when**: speaker system design, multi-band dynamics, band splitting for separate processing

</details>


### Crossfeed

Headphone crossfeed — mixes a filtered copy of each channel into the other to reduce in-head localization.

![Crossfeed](plot/crossfeed.svg)

Takes two separate channel buffers, modifies both in-place.

```js
import { crossfeed } from 'audio-filter/eq'

crossfeed(left, right, { fc: 700, level: 0.3, fs: 44100 })
```

<details>
<summary>Reference</summary>

**Origin**: Bauer (1961)[^15]; BS2B (Bauer Stereophonic-to-Binaural) algorithm

**Problem**: speaker playback has inter-channel crosstalk and head shadowing; headphones remove these, causing an unnatural "in-head" stereo image

**Solution**: add a lowpass-filtered, attenuated copy of each channel to the opposite channel, simulating crosstalk and head diffraction

**fc**: models the head-shadow lowpass (~700 Hz is typical); **level**: 0.3 = mild, 0.5 = strong

</details>


## Effect

Signal processing utilities — conditioning, shaping, and analyzing audio signals.


### DC blocker

Removes DC offset — the simplest useful filter.

![DC blocker](plot/dc-blocker.svg)

H(z) = (1 − z⁻¹) / (1 − R·z⁻¹)

```js
import { dcBlocker } from 'audio-filter/effect'

let params = { R: 0.995 }
dcBlocker(buffer, params)
```


### Comb filter

Adds a delayed copy of the signal to itself — notches and peaks at harmonics of fs/delay.

![Comb filter](plot/comb.svg)

```js
import { comb } from 'audio-filter/effect'

comb(buffer, { delay: 100, gain: 0.6, type: 'feedback' })
```


### Allpass

Unity magnitude at all frequencies — shifts phase only. First and second order.

![Allpass 2nd order](plot/allpass.svg)

```js
import { allpass } from 'audio-filter/effect'

allpass.first(buffer, { a: 0.5 })                          // coefficient a
allpass.second(buffer, { fc: 1000, Q: 1, fs: 44100 })      // center fc, quality Q
```


### Pre-emphasis / de-emphasis

First-order highpass (emphasis) and its inverse (de-emphasis) — used before and after coding or transmission.

![Pre-emphasis](plot/emphasis.svg)

H(z) = 1 − α·z⁻¹ &nbsp;(emphasis) &nbsp;/&nbsp; 1/(1 − α·z⁻¹) &nbsp;(de-emphasis)

```js
import { emphasis, deemphasis } from 'audio-filter/effect'

emphasis(buffer, { alpha: 0.97 })    // before encoding
deemphasis(buffer, { alpha: 0.97 })  // after decoding — exact inverse
```


### Resonator

Constant peak-gain bandpass — peak amplitude stays fixed regardless of bandwidth.

![Resonator](plot/resonator.svg)

H(z) = (1 − R²) / (1 − 2R·cos(ω₀)·z⁻¹ + R²·z⁻²)

```js
import { resonator } from 'audio-filter/effect'

resonator(buffer, { fc: 440, bw: 20, fs: 44100 })
```

Unlike a peaking EQ section, peak gain is always 0 dB regardless of Q — stable for synthesis use.


### Envelope follower

Tracks the instantaneous amplitude of a signal with configurable attack and release.

![Envelope follower](plot/envelope.svg)

```js
import { envelope } from 'audio-filter/effect'

let params = { attack: 0.001, release: 0.05, fs: 44100 }
envelope(buffer, params)   // buffer replaced with envelope signal (0–1)
```


### Slew limiter

Limits the rate of change — limits rise and fall rates separately.

![Slew limiter](plot/slew-limiter.svg)

```js
import { slewLimiter } from 'audio-filter/effect'

slewLimiter(buffer, { rise: 500, fall: 200, fs: 44100 })
```


### Noise shaping

Error-feedback dithering — quantizes to N bits while shaping quantization noise into high frequencies.

![Noise shaping](plot/noise-shaping.svg)

```js
import { noiseShaping } from 'audio-filter/effect'

noiseShaping(buffer, { bits: 16 })   // dither to 16-bit, noise shaped above 10 kHz
```


### Pink noise

Shapes white noise to 1/f spectrum — equal energy per octave.

![Pink noise filter](plot/pink-noise.svg)

```js
import { pinkNoise } from 'audio-filter/effect'

let buf = new Float64Array(1024)
for (let i = 0; i < buf.length; i++) buf[i] = Math.random() * 2 - 1
pinkNoise(buf, {})   // white → pink (−3 dB/oct spectral slope)
```


### Spectral tilt

Applies a constant dB/octave slope — tilts the entire spectrum.

![Spectral tilt](plot/spectral-tilt.svg)

```js
import { spectralTilt } from 'audio-filter/effect'

spectralTilt(buffer, { slope: -3, fs: 44100 })   // −3 dB/oct: brownian noise character
spectralTilt(buffer, { slope: +3, fs: 44100 })   // +3 dB/oct: pre-emphasis for coding
```


### Variable bandwidth

Lowpass with continuously variable bandwidth — smooth parameter automation without discontinuities.

![Variable bandwidth](plot/variable-bandwidth.svg)

```js
import { variableBandwidth } from 'audio-filter/effect'

variableBandwidth(buffer, { fc: 2000, Q: 1.0, fs: 44100 })
```


## Filter selection guide

| I need to... | Use |
|---|---|
| Measure SPL or noise level | `aWeighting` (general), `cWeighting` (peak), `itu468` (broadcast noise) |
| Measure loudness (LUFS/LU) | `kWeighting` |
| Decode vinyl audio | `riaa` |
| Model the cochlea / auditory system | `gammatone`, `erbBank` |
| Analyze a spectrum in octave bands | `octaveBank` |
| Psychoacoustic analysis / masking model | `barkBank` |
| Synth filter — warmth and resonance | `moogLadder` |
| Synth filter — acid / squelch | `diodeLadder` |
| Synth filter — 2-pole LP + HP | `korg35` |
| Synthesize vowel sounds | `formant` |
| Transfer one sound's spectral shape to another | `vocoder` |
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


## See also

- [digital-filter](https://github.com/audiojs/digital-filter) — general-purpose filter design: Butterworth, Chebyshev, Bessel, Elliptic, FIR, and more
- [audio-decode](https://github.com/audiojs/audio-decode) — decode audio files to PCM buffers
- [audio-speaker](https://github.com/audiojs/audio-speaker) — output PCM audio to system speakers
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — browser built-in audio; basic biquad shapes only, requires `AudioContext`


## References

[^1]: IEC 61672-1:2013, *Electroacoustics — Sound level meters — Part 1: Specifications*. Supersedes IEC 651:1979.

[^2]: ITU-R BS.1770-4:2015, *Algorithms to measure audio programme loudness and true-peak audio level*. Adopted by EBU R128.

[^3]: ITU-R BS.468-4:1986, *Measurement of audio-frequency noise voltage level in sound broadcasting*. Originally CCIR 468, 1968.

[^4]: RIAA standard (1954); IEC 60098:1987, *Analogue audio disk records and reproducing equipment*.

[^5]: Patterson, R.D., Robinson, K., Holdsworth, J., McKeown, D., Zhang, C. & Allerhand, M. (1992). "Complex sounds and auditory images." *Auditory Physiology and Perception*, Pergamon, pp. 429–446.

[^6]: IEC 61260-1:2014, *Electroacoustics — Octave-band and fractional-octave-band filters — Part 1: Specifications*. ANSI S1.11:2004.

[^7]: Moore, B.C.J. & Glasberg, B.R. (1983). "Suggested formulae for calculating auditory-filter bandwidths and excitation patterns." *Journal of the Acoustical Society of America* 74(3), pp. 750–753. Updated 1990.

[^8]: Zwicker, E. (1961). "Subdivision of the audible frequency range into critical bands." *Journal of the Acoustical Society of America* 33(2), p. 248.

[^9]: Zavalishin, V. (2012). *The Art of VA Filter Design*. Native Instruments.

[^10]: Moog, R.A. (1965). *Voltage controlled electronic music modules*. Patent US3475623.

[^11]: Pirkle, W.C. (2019). *Designing Audio Effect Plugins in C++*, 2nd ed. Routledge.

[^12]: Stilson, T. & Smith, J.O. (1996). "Analyzing the Moog VCF with considerations for digital implementation." *Proc. International Computer Music Conference (ICMC)*.

[^13]: Dudley, H. (1939). "The vocoder." *Bell Laboratories Record* 17, pp. 122–126. Patent US2151091.

[^14]: Linkwitz, S. & Riley, R. (1976). "Active Crossover Networks for Non-Coincident Drivers." *Journal of the Audio Engineering Society* 24(1), pp. 2–8.

[^15]: Bauer, B.B. (1961). "Stereophonic Earphones and Binaural Loudspeakers." *Journal of the Audio Engineering Society* 9(2), pp. 148–151.
