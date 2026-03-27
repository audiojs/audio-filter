/**
 * Graphic equalizer using ISO octave-band center frequencies.
 *
 * @module  digital-filter/graphic-eq
 */

import { peaking } from 'digital-filter/iir/biquad.js'
import filter from 'digital-filter/core/filter.js'

let BANDS = [31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { gains: {31.25: dB, 62.5: dB, ...}, fs }
 */
export default function graphicEq (data, params) {
	let fs = params.fs || 44100
	let gains = params.gains || {}

	// Rebuild coefficients when gains change
	let key = JSON.stringify(gains)
	if (params._key !== key) {
		params._filters = []
		for (let i = 0; i < BANDS.length; i++) {
			let fc = BANDS[i]
			let g = gains[fc] || gains[Math.round(fc)] || 0
			if (g === 0) continue
			params._filters.push({ coefs: peaking(fc, 1.4, fs, g) })
		}
		params._key = key
	}

	for (let f of params._filters) filter(data, f)

	return data
}
