/**
 * ERB-spaced filter bank using gammatone filters.
 * Bands spaced according to the Equivalent Rectangular Bandwidth scale,
 * matching human auditory frequency resolution.
 *
 * Reference: Glasberg & Moore, "Derivation of auditory filter shapes
 * from notched-noise data", Hearing Research 47 (1990).
 *
 * @module digital-filter/erb-bank
 */

/**
 * Generate ERB-spaced filter bank center frequencies and bandwidths.
 * @param {number} fs - Sample rate (default 44100)
 * @param {object} opts - { fmin: 50, fmax: 16000, density: 1 (bands per ERB) }
 * @returns {Array<{fc: number, erb: number, bw: number}>}
 */
export default function erbBank (fs, opts) {
	if (!fs) fs = 44100
	if (!opts) opts = {}
	let fmin = opts.fmin || 50
	let fmax = opts.fmax || Math.min(16000, fs / 2)
	let density = opts.density || 1

	let bands = []

	// ERB scale: ERB(f) = 24.7 * (4.37 * f/1000 + 1)
	// ERB number: E(f) = 21.4 * log10(4.37 * f/1000 + 1)
	let eMin = 21.4 * Math.log10(4.37 * fmin / 1000 + 1)
	let eMax = 21.4 * Math.log10(4.37 * fmax / 1000 + 1)
	let step = 1 / density

	for (let e = eMin; e <= eMax; e += step) {
		// Inverse ERB number → frequency
		let fc = (Math.pow(10, e / 21.4) - 1) * 1000 / 4.37
		if (fc < fmin || fc > fmax) continue
		let erb = 24.7 * (4.37 * fc / 1000 + 1)
		bands.push({ fc: Math.round(fc * 10) / 10, erb: Math.round(erb * 10) / 10, bw: Math.round(erb * 10) / 10 })
	}

	return bands
}
