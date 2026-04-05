/**
 * Highpass filter — removes everything below cutoff frequency.
 * Order 2 (default): RBJ biquad. Order 4+: Butterworth cascaded SOS.
 *
 * @module  audio-filter/effect/highpass
 */

import { highpass as biquadHp } from 'digital-filter/iir/biquad.js'
import butterworth from 'digital-filter/iir/butterworth.js'
import filter from 'digital-filter/core/filter.js'

/**
 * @param {Float32Array|Float64Array} data - Input (modified in-place)
 * @param {object} params - { fc, order?, Q?, fs? }
 */
export default function highpass (data, params) {
	let fc = params.fc, fs = params.fs || 44100
	let order = params.order || 2, Q = params.Q == null ? 0.707 : params.Q

	if (!params.coefs || params._fc !== fc || params._order !== order || params._Q !== Q || params._fs !== fs) {
		params.coefs = order <= 2 ? [biquadHp(fc, Q, fs)] : butterworth(order, fc, fs, 'highpass')
		params._fc = fc; params._order = order; params._Q = Q; params._fs = fs
	}

	return filter(data, params)
}
