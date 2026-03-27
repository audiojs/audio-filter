/**
 * N-band parametric EQ.
 *
 * @module  digital-filter/parametric-eq
 */

import { peaking, lowshelf, highshelf } from 'digital-filter/iir/biquad.js'
import filter from 'digital-filter/core/filter.js'

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { bands: [{fc, Q, gain, type}], fs }
 *   type: 'peak' (default), 'lowshelf', 'highshelf'
 */
export default function parametricEq (data, params) {
	let fs = params.fs || 44100
	let bands = params.bands || []

	if (!params._filters || params._dirty) {
		params._filters = bands.map(b => {
			let fn = b.type === 'lowshelf' ? lowshelf : b.type === 'highshelf' ? highshelf : peaking
			return { coefs: fn(b.fc, b.Q || 1, fs, b.gain || 0) }
		})
		params._dirty = false
	}

	for (let f of params._filters) filter(data, f)

	return data
}
