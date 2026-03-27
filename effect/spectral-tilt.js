/**
 * Spectral tilt filter: apply a constant dB/octave slope to the spectrum.
 * Implemented as a cascade of first-order shelving sections.
 *
 * @module  digital-filter/spectral-tilt
 */

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { slope: dB per octave (positive = boost high), fs }
 */
export default function spectralTilt (data, params) {
	let slope = params.slope || 0  // dB/octave
	let fs = params.fs || 44100

	if (slope === 0) return data

	// Use a cascade of first-order filters at octave-spaced frequencies
	if (!params._s) {
		let nStages = 8
		params._s = new Float64Array(nStages)
		params._coefs = []
		for (let j = 0; j < nStages; j++) {
			let fc = 62.5 * Math.pow(2, j) // 62.5, 125, 250, ... 8kHz
			if (fc >= fs / 2) continue
			let a = Math.exp(-2 * Math.PI * fc / fs)
			let gain = Math.pow(10, slope / 20)  // gain per octave
			params._coefs.push({ a, gain })
		}
	}

	let s = params._s
	let coefs = params._coefs

	for (let i = 0, n = data.length; i < n; i++) {
		let x = data[i]
		for (let j = 0; j < coefs.length; j++) {
			let c = coefs[j]
			s[j] = c.a * s[j] + (1 - c.a) * x
			x = s[j] * c.gain + (x - s[j])
		}
		data[i] = x
	}

	return data
}
