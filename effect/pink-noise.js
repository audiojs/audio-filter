/**
 * Pink noise filter (1/f spectral slope, -3dB/octave).
 * IIR approximation using Paul Kellet's refined method.
 * Apply to white noise to produce pink noise.
 *
 * @param {Float64Array} data - White noise input (modified in-place)
 * @param {object} params - {b0-b6: state variables}
 * @returns {Float64Array} pink noise
 */
export default function pinkNoise (data, params) {
	let b0 = params.b0 || 0
	let b1 = params.b1 || 0
	let b2 = params.b2 || 0
	let b3 = params.b3 || 0
	let b4 = params.b4 || 0
	let b5 = params.b5 || 0
	let b6 = params.b6 || 0

	for (let i = 0; i < data.length; i++) {
		let white = data[i]
		b0 = 0.99886 * b0 + white * 0.0555179
		b1 = 0.99332 * b1 + white * 0.0750759
		b2 = 0.96900 * b2 + white * 0.1538520
		b3 = 0.86650 * b3 + white * 0.3104856
		b4 = 0.55000 * b4 + white * 0.5329522
		b5 = -0.7616 * b5 - white * 0.0168980
		data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
		b6 = white * 0.115926
	}

	params.b0 = b0; params.b1 = b1; params.b2 = b2
	params.b3 = b3; params.b4 = b4; params.b5 = b5; params.b6 = b6
	return data
}
