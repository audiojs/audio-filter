/**
 * Tilt EQ — see-saw around a pivot frequency.
 * One knob: positive tilts bass up / treble down, negative does the opposite.
 *
 * @module  audio-filter/eq/tilt
 */

import { lowshelf, highshelf } from 'digital-filter/iir/biquad.js'
import dfFilter from 'digital-filter/core/filter.js'

export default function tilt (data, params) {
	let gain = params.gain ?? 0       // dB: positive = bass boost / treble cut
	let pivot = params.pivot || 1000  // Hz
	let fs = params.fs || 44100

	if (!params._lo) { params._lo = {}; params._hi = {} }

	if (params._gain !== gain || params._pivot !== pivot || params._fs !== fs) {
		params._lo.coefs = [lowshelf(pivot, 0.5, fs, gain)]
		params._hi.coefs = [highshelf(pivot, 0.5, fs, -gain)]
		params._gain = gain; params._pivot = pivot; params._fs = fs
	}

	dfFilter(data, params._lo)
	dfFilter(data, params._hi)

	return data
}
