import filter from 'digital-filter/core/filter.js'

/**
 * Apply noise shaping to quantization.
 * Feeds quantization error through a filter to shape the noise spectrum.
 *
 * @param {Float64Array} data - Input signal (modified in-place with quantized + shaped output)
 * @param {object} params - {bits, coefs, state}
 *   bits: target bit depth (default 16)
 *   coefs: noise shaping filter SOS (default: first-order highpass)
 *   state: filter state (persists)
 * @returns {Float64Array} quantized + noise-shaped data
 */
export default function noiseShaping (data, params) {
	let bits = params.bits || 16
	let scale = Math.pow(2, bits - 1)

	// Default: first-order highpass noise shaping (error feedback)
	let coefs = params.coefs || [{b0: 1, b1: -1, b2: 0, a1: 0, a2: 0}]
	if (!params._fb) params._fb = 0
	let fb = params._fb

	for (let i = 0; i < data.length; i++) {
		// Add shaped feedback
		let x = data[i] + fb

		// Quantize
		let q = Math.round(x * scale) / scale

		// Error = quantized - original (before feedback)
		let err = q - data[i]

		// Shape error (first-order: just feed back the error with highpass shape)
		// For first-order: fb = -err (simple error feedback)
		fb = -err

		data[i] = q
	}

	params._fb = fb
	return data
}
