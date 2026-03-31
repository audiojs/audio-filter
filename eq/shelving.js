/**
 * Standalone shelving filters — low shelf and high shelf.
 * RBJ biquad shelf design.
 *
 * @module  audio-filter/eq/shelving
 */

import { lowshelf, highshelf } from 'digital-filter/iir/biquad.js'
import dfFilter from 'digital-filter/core/filter.js'

export function lowShelf (data, params) {
	let fc = params.fc || 200, gain = params.gain || 0
	let Q = params.Q == null ? 0.707 : params.Q, fs = params.fs || 44100

	if (!params._lo || params._fc !== fc || params._gain !== gain || params._Q !== Q || params._fs !== fs) {
		params._lo = { coefs: [lowshelf(fc, Q, fs, gain)] }
		params._fc = fc; params._gain = gain; params._Q = Q; params._fs = fs
	}

	return dfFilter(data, params._lo)
}

export function highShelf (data, params) {
	let fc = params.fc || 4000, gain = params.gain || 0
	let Q = params.Q == null ? 0.707 : params.Q, fs = params.fs || 44100

	if (!params._hi || params._fc !== fc || params._gain !== gain || params._Q !== Q || params._fs !== fs) {
		params._hi = { coefs: [highshelf(fc, Q, fs, gain)] }
		params._fc = fc; params._gain = gain; params._Q = Q; params._fs = fs
	}

	return dfFilter(data, params._hi)
}
