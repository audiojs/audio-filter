/**
 * Parallel formant filter bank.
 * Used for vowel/formant synthesis.
 *
 * @module  digital-filter/formant
 */

import resonator from '../effect/resonator.js'

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { formants: [{fc, bw, gain}], fs }
 */
export default function formant (data, params) {
	let fs = params.fs || 44100
	let formants = params.formants || [
		{fc: 730, bw: 90, gain: 1},    // F1 (open vowel /a/)
		{fc: 1090, bw: 110, gain: 0.5},
		{fc: 2440, bw: 170, gain: 0.3}
	]

	if (!params._states) {
		params._states = formants.map(f => ({fc: f.fc, bw: f.bw || 50, fs, _gain: f.gain || 1}))
	}

	let input = Float64Array.from(data)
	data.fill(0)

	for (let i = 0; i < formants.length; i++) {
		let band = Float64Array.from(input)
		resonator(band, params._states[i])
		let g = params._states[i]._gain
		for (let j = 0; j < data.length; j++) data[j] += band[j] * g
	}

	return data
}
