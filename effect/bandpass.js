/**
 * Bandpass filter — passes frequencies around center frequency, rejects rest.
 * RBJ biquad bandpass (constant 0 dB peak gain).
 *
 * @module  audio-filter/effect/bandpass
 */

import { bandpass as biquadBp } from 'digital-filter/iir/biquad.js'
import filter from 'digital-filter/core/filter.js'

/**
 * @param {Float32Array|Float64Array} data - Input (modified in-place)
 * @param {object} params - { fc, Q?, fs? }
 */
export default function bandpass (data, params) {
	let fc = params.fc, Q = params.Q == null ? 0.707 : params.Q, fs = params.fs || 44100

	if (!params.coefs || params._fc !== fc || params._Q !== Q || params._fs !== fs) {
		params.coefs = [biquadBp(fc, Q, fs)]
		params._fc = fc; params._Q = Q; params._fs = fs
	}

	return filter(data, params)
}
