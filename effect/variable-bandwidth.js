/**
 * Variable-bandwidth filter with smooth coefficient interpolation.
 * Recomputes biquad coefficients when fc/Q change.
 *
 * @module  digital-filter/variable-bandwidth
 */

import { lowpass, highpass, bandpass2 } from 'digital-filter/iir/biquad.js'

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { fc, Q, fs, type: 'lowpass'|'highpass'|'bandpass' }
 */
export default function variableBandwidth (data, params) {
	let fc = params.fc || 1000
	let Q = params.Q || 0.707
	let fs = params.fs || 44100
	let type = params.type || 'lowpass'

	let fn = type === 'highpass' ? highpass : type === 'bandpass' ? bandpass2 : lowpass

	if (!params._coefs || params._fc !== fc || params._Q !== Q) {
		params._coefs = fn(fc, Q, fs)
		params._fc = fc
		params._Q = Q
	}

	if (!params._state) params._state = [0, 0]
	let c = params._coefs, s = params._state

	for (let i = 0, n = data.length; i < n; i++) {
		let x = data[i]
		let y = c.b0 * x + s[0]
		s[0] = c.b1 * x - c.a1 * y + s[1]
		s[1] = c.b2 * x - c.a2 * y
		data[i] = y
	}

	return data
}
