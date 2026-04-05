/**
 * High-shelf filter — boost or cut above a corner frequency.
 * RBJ biquad shelf design.
 *
 * @module  audio-filter/eq/highshelf
 */

import { highshelf } from 'digital-filter/iir/biquad.js'
import dfFilter from 'digital-filter/core/filter.js'

export default function highShelf (data, params) {
	let fc = params.fc || 4000, gain = params.gain || 0
	let Q = params.Q == null ? 0.707 : params.Q, fs = params.fs || 44100

	if (!params._hi || params._fc !== fc || params._gain !== gain || params._Q !== Q || params._fs !== fs) {
		params._hi = { coefs: [highshelf(fc, Q, fs, gain)] }
		params._fc = fc; params._gain = gain; params._Q = Q; params._fs = fs
	}

	return dfFilter(data, params._hi)
}
