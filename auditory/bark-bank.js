/**
 * Bark-scale filter bank.
 * Bands spaced according to the Bark psychoacoustic scale (critical bands).
 *
 * Reference: Zwicker & Terhardt, "Analytical expressions for critical-band
 * rate and critical bandwidth as a function of frequency", JASA 68 (1980).
 *
 * @module digital-filter/bark-bank
 */

import { bandpass2 } from 'digital-filter/iir/biquad.js'

// Standard 24 Bark critical bands (Zwicker)
let BARK_EDGES = [
	20, 100, 200, 300, 400, 510, 630, 770, 920, 1080, 1270, 1480, 1720,
	2000, 2320, 2700, 3150, 3700, 4400, 5300, 6400, 7700, 9500, 12000, 15500
]

/**
 * Generate Bark-scale filter bank.
 * @param {number} fs - Sample rate (default 44100)
 * @param {object} opts - { fmin: 20, fmax: 15500 }
 * @returns {Array<{bark: number, fLow: number, fHigh: number, fc: number, coefs: {b0,b1,b2,a1,a2}}>}
 */
export default function barkBank (fs, opts) {
	if (!fs) fs = 44100
	if (!opts) opts = {}
	let fmin = opts.fmin || 20
	let fmax = opts.fmax || Math.min(15500, fs / 2)
	let nyq = fs / 2

	let bands = []

	for (let i = 0; i < BARK_EDGES.length - 1; i++) {
		let fLow = BARK_EDGES[i]
		let fHigh = BARK_EDGES[i + 1]
		if (fHigh < fmin || fLow > fmax || fHigh > nyq) continue
		fLow = Math.max(fLow, fmin)
		fHigh = Math.min(fHigh, fmax, nyq * 0.95)
		let fc = Math.sqrt(fLow * fHigh)
		let Q = fc / (fHigh - fLow)

		bands.push({
			bark: i + 1,
			fLow: Math.round(fLow),
			fHigh: Math.round(fHigh),
			fc: Math.round(fc * 10) / 10,
			coefs: bandpass2(fc, Q, fs)
		})
	}

	return bands
}
