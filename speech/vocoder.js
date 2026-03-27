/**
 * Channel vocoder.
 * Analyzes modulator's spectral envelope, applies it to carrier.
 *
 * @module  digital-filter/vocoder
 */

import { bandpass2 } from 'digital-filter/iir/biquad.js'
import filter from 'digital-filter/core/filter.js'
import envelope from '../effect/envelope.js'

/**
 * @param {Float64Array} carrier - Carrier signal (e.g., sawtooth)
 * @param {Float64Array} modulator - Modulator signal (e.g., voice)
 * @param {object} params - { bands: number of bands (16), fmin, fmax, fs }
 * @returns {Float64Array} Vocoded output
 */
export default function vocoder (carrier, modulator, params) {
	let nBands = params.bands || 16
	let fmin = params.fmin || 100
	let fmax = params.fmax || 8000
	let fs = params.fs || 44100
	let N = carrier.length

	if (!params._analysis) {
		params._analysis = []
		params._synthesis = []
		params._envStates = []

		for (let i = 0; i < nBands; i++) {
			let fc = fmin * Math.pow(fmax / fmin, i / (nBands - 1))
			let Q = 5
			let coefs = bandpass2(fc, Q, fs)
			params._analysis.push({coefs})
			params._synthesis.push({coefs})
			params._envStates.push({attack: 0.005, release: 0.05, fs})
		}
	}

	let output = new Float64Array(N)

	for (let i = 0; i < nBands; i++) {
		// Analysis: extract modulator envelope per band
		let modBand = Float64Array.from(modulator)
		filter(modBand, params._analysis[i])
		envelope(modBand, params._envStates[i])

		// Synthesis: filter carrier per band
		let carBand = Float64Array.from(carrier)
		filter(carBand, params._synthesis[i])

		// Multiply carrier band by modulator envelope
		for (let j = 0; j < N; j++) output[j] += carBand[j] * modBand[j]
	}

	return output
}
