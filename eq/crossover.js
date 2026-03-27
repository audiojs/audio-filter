/**
 * N-way crossover network using Linkwitz-Riley filters.
 *
 * @module  digital-filter/crossover
 */

import linkwitzRiley from 'digital-filter/iir/linkwitz-riley.js'

/**
 * @param {Array} frequencies - Crossover frequencies [f1, f2, ...] (N-1 frequencies for N bands)
 * @param {number} order - LR order (2, 4, or 8)
 * @param {number} fs - Sample rate
 * @returns {Array<Array<{b0,b1,b2,a1,a2}>>} Array of SOS arrays, one per band
 */
export default function crossover (frequencies, order, fs) {
	if (!order) order = 4
	if (!fs) fs = 44100

	let bands = []

	for (let i = 0; i <= frequencies.length; i++) {
		if (i === 0) {
			// First band: lowpass at first crossover
			bands.push(linkwitzRiley(order, frequencies[0], fs).low)
		} else if (i === frequencies.length) {
			// Last band: highpass at last crossover
			bands.push(linkwitzRiley(order, frequencies[i - 1], fs).high)
		} else {
			// Middle band: highpass at lower + lowpass at upper
			let hp = linkwitzRiley(order, frequencies[i - 1], fs).high
			let lp = linkwitzRiley(order, frequencies[i], fs).low
			bands.push(hp.concat(lp))
		}
	}

	return bands
}
