/**
 * Headphone crossfeed filter.
 * Mixes L->R and R->L through a frequency-dependent filter to improve imaging.
 *
 * @module  digital-filter/crossfeed
 */

import { lowpass } from 'digital-filter/iir/biquad.js'
import filter from 'digital-filter/core/filter.js'

/**
 * @param {Float64Array} left - Left channel (modified in-place)
 * @param {Float64Array} right - Right channel (modified in-place)
 * @param {object} params - { fc: crossfeed cutoff (700), level: mix amount 0-1 (0.3), fs }
 */
export default function crossfeed (left, right, params) {
	let fc = params.fc || 700
	let level = params.level != null ? params.level : 0.3
	let fs = params.fs || 44100

	if (!params._coefs) params._coefs = lowpass(fc, 0.5, fs)
	if (!params._stateL) params._stateL = { coefs: params._coefs }
	if (!params._stateR) params._stateR = { coefs: params._coefs }

	// Filter copies for crossfeed
	let crossL = Float64Array.from(right)
	let crossR = Float64Array.from(left)

	filter(crossL, params._stateL)
	filter(crossR, params._stateR)

	for (let i = 0; i < left.length; i++) {
		left[i] = left[i] * (1 - level * 0.5) + crossL[i] * level
		right[i] = right[i] * (1 - level * 0.5) + crossR[i] * level
	}

	return { left, right }
}
