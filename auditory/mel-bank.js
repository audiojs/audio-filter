/**
 * Mel-frequency triangular filter bank.
 * Bands spaced according to the mel scale, used in MFCC feature extraction
 * for speech recognition and music information retrieval.
 *
 * Reference: O'Shaughnessy, "Speech Communications: Human and Machine",
 * IEEE Press, 2000. mel(f) = 2595 * log10(1 + f/700).
 *
 * @module digital-filter/mel-bank
 */

let mel = f => 2595 * Math.log10(1 + f / 700)
let hz = m => 700 * (Math.pow(10, m / 2595) - 1)

/**
 * Generate mel-spaced triangular filter bank.
 * @param {number} fs - Sample rate (default 44100)
 * @param {object} opts - { fmin: 0, fmax: fs/2, nFilters: 26 }
 * @returns {Array<{fc: number, fLow: number, fHigh: number, mel: number}>}
 */
export default function melBank (fs, opts) {
	if (!fs) fs = 44100
	if (!opts) opts = {}
	let fmin = opts.fmin || 0
	let fmax = opts.fmax || fs / 2
	let nFilters = opts.nFilters || 26

	// nFilters+2 equally-spaced points in mel scale
	let mMin = mel(fmin)
	let mMax = mel(fmax)
	let step = (mMax - mMin) / (nFilters + 1)
	let points = []
	for (let i = 0; i < nFilters + 2; i++) points.push(hz(mMin + i * step))

	let bands = []
	for (let i = 0; i < nFilters; i++) {
		let fLow = points[i]
		let fc = points[i + 1]
		let fHigh = points[i + 2]
		bands.push({
			fc: Math.round(fc * 10) / 10,
			fLow: Math.round(fLow * 10) / 10,
			fHigh: Math.round(fHigh * 10) / 10,
			mel: Math.round(mel(fc) * 10) / 10
		})
	}

	return bands
}
