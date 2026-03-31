/**
 * Baxandall tone control — bass/treble shelving with reciprocal characteristics.
 * The canonical tone control in amplifiers, mixers, guitar pedals.
 *
 * @module  audio-filter/eq/baxandall
 */

import { lowshelf, highshelf } from 'digital-filter/iir/biquad.js'
import dfFilter from 'digital-filter/core/filter.js'

export default function baxandall (data, params) {
	let bass = params.bass ?? 0       // dB
	let treble = params.treble ?? 0   // dB
	let fBass = params.fBass || 250
	let fTreble = params.fTreble || 4000
	let fs = params.fs || 44100

	if (!params._b) { params._b = {}; params._t = {} }

	if (params._bass !== bass || params._fBass !== fBass || params._fs !== fs) {
		params._b.coefs = [lowshelf(fBass, 0.707, fs, bass)]
		params._bass = bass; params._fBass = fBass
	}
	if (params._treble !== treble || params._fTreble !== fTreble || params._fs !== fs) {
		params._t.coefs = [highshelf(fTreble, 0.707, fs, treble)]
		params._treble = treble; params._fTreble = fTreble; params._fs = fs
	}

	dfFilter(data, params._b)
	dfFilter(data, params._t)

	return data
}
