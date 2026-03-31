/**
 * Notch (band-reject) filter — unity gain everywhere except a null at fc.
 * RBJ biquad notch: zeros on unit circle at ±w0, poles pulled inside.
 *
 * @module  audio-filter/effect/notch
 */

import { notch as biquadNotch } from 'digital-filter/iir/biquad.js'
import filter from 'digital-filter/core/filter.js'

export default function notch (data, params) {
	let fc = params.fc, Q = params.Q == null ? 30 : params.Q, fs = params.fs || 44100

	if (!params.coefs || params._fc !== fc || params._Q !== Q || params._fs !== fs) {
		params.coefs = [biquadNotch(fc, Q, fs)]
		params._fc = fc
		params._Q = Q
		params._fs = fs
	}

	return filter(data, params)
}
