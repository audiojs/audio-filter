// audio-filter — TypeScript declarations

type Buf = Float32Array | Float64Array | number[]

/** One biquad section: H(z) = (b0 + b1*z⁻¹ + b2*z⁻²) / (1 + a1*z⁻¹ + a2*z⁻²) */
export interface BiquadCoef { b0: number; b1: number; b2: number; a1: number; a2: number }

/** Array of biquad sections (second-order sections) */
export type SOS = BiquadCoef[]

// ---------------------------------------------------------------------------
// Weighting — in-place processors (state in params)
// ---------------------------------------------------------------------------

export interface WeightingParams { fs?: number; state?: [number, number][] | null; [key: string]: unknown }

type WeightingFilter = { (data: Buf, params?: WeightingParams): Buf; coefs(fs?: number): SOS }

/** IEC 61672 A-weighting, in-place. `.coefs(fs)` returns SOS for analysis. */
export const aWeighting: WeightingFilter
/** IEC 61672 C-weighting, in-place. `.coefs(fs)` returns SOS for analysis. */
export const cWeighting: WeightingFilter
/** ITU-R BS.1770 K-weighting, in-place. `.coefs(fs)` returns SOS for analysis. */
export const kWeighting: WeightingFilter
/** ITU-R 468 noise-weighting, in-place. `.coefs(fs)` returns SOS for analysis. */
export const itu468: WeightingFilter
/** RIAA playback equalization, in-place. `.coefs(fs)` returns SOS for analysis. */
export const riaa: WeightingFilter

// ---------------------------------------------------------------------------
// Auditory — cochlear / perceptual models
// ---------------------------------------------------------------------------

export interface GammatoneParams {
  fc?: number        // center frequency Hz (default 1000)
  fs?: number        // sample rate (default 44100)
  order?: number     // filter order (default 4)
  [key: string]: unknown
}

/** Gammatone auditory filter — 4th-order cochlear model, in-place */
export function gammatone(data: Buf, params: GammatoneParams): Buf

export interface BankOpts {
  fmin?: number      // lowest band center Hz
  fmax?: number      // highest band center Hz
}

export interface OctaveBand { fc: number; coefs: SOS }
export interface ErbBand    { fc: number; erb: number; bw: number }
export interface BarkBand   { fc: number; coefs: SOS }

/** IEC 61260 fractional-octave filter bank */
export function octaveBank(fraction: number, fs?: number, opts?: BankOpts): OctaveBand[]

/** ERB-spaced gammatone filter bank */
export function erbBank(fs?: number, opts?: BankOpts): ErbBand[]

/** Bark-scale critical-band filter bank */
export function barkBank(fs?: number, opts?: BankOpts): BarkBand[]

export interface MelBankOpts extends BankOpts {
  nFilters?: number   // number of mel filters (default 26)
}

export interface MelBand { fc: number; fLow: number; fHigh: number; mel: number }

/** Mel-frequency triangular filter bank */
export function melBank(fs?: number, opts?: MelBankOpts): MelBand[]

// ---------------------------------------------------------------------------
// Analog — virtual analog circuit models (in-place, state in params)
// ---------------------------------------------------------------------------

export interface LadderParams {
  fc?: number        // cutoff frequency Hz (default 1000)
  resonance?: number // 0–1, self-oscillation at 1
  fs?: number        // sample rate (default 44100)
  drive?: number     // input drive / saturation amount (default 1)
  [key: string]: unknown
}

/** Moog 4-pole transistor ladder lowpass — ZDF, –24 dB/oct */
export function moogLadder(data: Buf, params: LadderParams): Buf

/** Diode ladder lowpass (Roland TB-303 style) — ZDF, –24 dB/oct */
export function diodeLadder(data: Buf, params: LadderParams): Buf

export interface Korg35Params extends LadderParams {
  type?: 'lowpass' | 'highpass'
}

/** Korg35 2-pole filter (MS-20 style) — ZDF, –12 dB/oct */
export function korg35(data: Buf, params: Korg35Params): Buf

export interface OberheimParams {
  fc?: number        // cutoff frequency Hz (default 1000)
  resonance?: number // 0–1 (default 0)
  type?: 'lowpass' | 'highpass' | 'bandpass' | 'notch'
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

/** Oberheim SEM 2-pole state-variable filter — ZDF, –12 dB/oct, multimode */
export function oberheim(data: Buf, params: OberheimParams): Buf

// ---------------------------------------------------------------------------
// Speech — vocal tract models
// ---------------------------------------------------------------------------

export interface Formant { fc: number; bw?: number; gain?: number }

export interface FormantParams {
  formants?: Formant[]
  fs?: number
  [key: string]: unknown
}

/** Parallel formant filter bank for vowel synthesis, in-place */
export function formant(data: Buf, params: FormantParams): Buf

export interface VocoderParams {
  bands?: number     // number of bands (default 16)
  fmin?: number      // lowest band Hz (default 100)
  fmax?: number      // highest band Hz (default 8000)
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

/** Channel vocoder — applies modulator spectral envelope to carrier */
export function vocoder(carrier: Buf, modulator: Buf, params: VocoderParams): Buf

export interface LpcParams {
  order?: number     // LPC order (default 12)
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

export interface LpcResult {
  coefs: Float64Array  // LPC coefficients a[1..order]
  gain: number         // prediction error gain
  residual: Float64Array // prediction residual
}

/** LPC analysis — autocorrelation + Levinson-Durbin */
export function lpcAnalysis(data: Buf, params?: LpcParams): LpcResult

export interface LpcSynthParams {
  coefs: Float64Array | number[]
  gain: number
  [key: string]: unknown
}

/** LPC synthesis — all-pole filter reconstruction from residual */
export function lpcSynthesize(residual: Buf, params: LpcSynthParams): Buf

// ---------------------------------------------------------------------------
// EQ — equalization
// ---------------------------------------------------------------------------

export interface GraphicEqParams {
  gains?: Record<number, number>  // { 1000: 6, 4000: -3, … } dB per band
  fs?: number
  [key: string]: unknown
}

/** ISO octave-band graphic equalizer (10 bands: 31.25 Hz – 16 kHz), in-place */
export function graphicEq(data: Buf, params: GraphicEqParams): Buf

export interface PeqBand { fc: number; Q?: number; gain: number; type?: string }

export interface ParametricEqParams {
  bands?: PeqBand[]
  fs?: number
  [key: string]: unknown
}

/** Multi-band parametric EQ, in-place */
export function parametricEq(data: Buf, params: ParametricEqParams): Buf

/** Linkwitz-Riley crossover — returns one SOS array per output band */
export function crossover(frequencies: number[], order: number, fs: number): SOS[]

export interface CrossfeedParams {
  fc?: number        // crossfeed cutoff Hz (default 700)
  level?: number     // mix 0–1 (default 0.3)
  fs?: number
  [key: string]: unknown
}

/** Bauer stereophonic-to-binaural crossfeed, in-place on both channels */
export function crossfeed(left: Buf, right: Buf, params: CrossfeedParams): void

export interface ShelfParams {
  fc?: number        // corner frequency Hz
  gain?: number      // dB boost/cut (default 0)
  Q?: number         // slope control (default 0.707)
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

/** Low-shelf filter — boost or cut below corner frequency */
export function lowShelf(data: Buf, params: ShelfParams): Buf
/** High-shelf filter — boost or cut above corner frequency */
export function highShelf(data: Buf, params: ShelfParams): Buf

export interface BaxandallParams {
  bass?: number      // dB (default 0)
  treble?: number    // dB (default 0)
  fBass?: number     // bass pivot Hz (default 250)
  fTreble?: number   // treble pivot Hz (default 4000)
  fs?: number
  [key: string]: unknown
}

/** Baxandall bass/treble tone control — cascaded low-shelf + high-shelf */
export function baxandall(data: Buf, params: BaxandallParams): Buf

export interface TiltParams {
  gain?: number      // dB: positive = bass up / treble down (default 0)
  pivot?: number     // pivot frequency Hz (default 1000)
  fs?: number
  [key: string]: unknown
}

/** Tilt EQ — see-saw around a pivot frequency */
export function tilt(data: Buf, params: TiltParams): Buf

// ---------------------------------------------------------------------------
// Effect — signal processing utilities (in-place, state in params)
// ---------------------------------------------------------------------------

export interface DcBlockerParams { R?: number; [key: string]: unknown }
/** DC blocking filter H(z) = (1−z⁻¹)/(1−R·z⁻¹) */
export function dcBlocker(data: Buf, params?: DcBlockerParams): Buf

export interface CombParams {
  delay: number      // delay in samples
  gain?: number      // feedback/feedforward gain (default 0.5)
  type?: 'feedforward' | 'feedback'
  [key: string]: unknown
}
/** Comb filter (feedforward FIR or feedback IIR) */
export function comb(data: Buf, params: CombParams): Buf

export interface AllpassParams { a?: number; fc?: number; Q?: number; fs?: number; [key: string]: unknown }
/** Allpass filters — unity magnitude, frequency-dependent phase shift */
export declare namespace allpass {
  function first(data: Buf, params: AllpassParams): Buf
  function second(data: Buf, params: AllpassParams): Buf
}

export interface EmphasisParams { alpha?: number; [key: string]: unknown }
/** Pre-emphasis H(z) = 1 − α·z⁻¹ */
export function emphasis(data: Buf, params?: EmphasisParams): Buf
/** De-emphasis H(z) = 1/(1 − α·z⁻¹) */
export function deemphasis(data: Buf, params?: EmphasisParams): Buf

export interface ResonatorParams { fc: number; bw?: number; fs?: number; [key: string]: unknown }
/** Constant-peak-gain resonator — modal synthesis (bells, drums, formants) */
export function resonator(data: Buf, params: ResonatorParams): Buf

/** Voss-McCartney pink noise from white noise input */
export function pinkNoise(data: Buf, params?: Record<string, unknown>): Buf

export interface SpectralTiltParams { slope?: number; fs?: number; [key: string]: unknown }
/** Spectral tilt — first-order shelving, ±dB/oct */
export function spectralTilt(data: Buf, params?: SpectralTiltParams): Buf

export interface VariableBandwidthParams {
  fc?: number
  Q?: number
  fs?: number
  type?: 'lowpass' | 'highpass' | 'bandpass'
  [key: string]: unknown
}
/** Variable-bandwidth biquad filter (recalculates coefficients each block) */
export function variableBandwidth(data: Buf, params?: VariableBandwidthParams): Buf

export interface FilterParams {
  fc?: number        // cutoff/center frequency Hz
  Q?: number         // quality factor (default 0.707)
  order?: number     // filter order: 2 = biquad, 4+ = Butterworth cascade
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

/** Highpass filter — removes below cutoff. Order 2: RBJ biquad. Order 4+: Butterworth SOS. */
export function highpass(data: Buf, params: FilterParams): Buf
/** Lowpass filter — removes above cutoff. Order 2: RBJ biquad. Order 4+: Butterworth SOS. */
export function lowpass(data: Buf, params: FilterParams): Buf
/** Bandpass filter — passes around center frequency, rejects rest. RBJ biquad. */
export function bandpass(data: Buf, params: FilterParams): Buf

export interface NotchParams {
  fc?: number        // notch frequency Hz
  Q?: number         // quality factor (default 30)
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

/** Notch (band-reject) filter — unity gain except null at fc */
export function notch(data: Buf, params: NotchParams): Buf
