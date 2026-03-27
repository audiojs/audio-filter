/**
 * Constant-peak-gain resonator
 * Unlike peaking EQ, the peak gain stays constant regardless of Q.
 * Used for modal synthesis (bells, drums), formant synthesis.
 *
 * H(z) = (1-R²) / (1 - 2R*cos(w0)*z^-1 + R²*z^-2)
 * where R = 1 - π*BW/fs, w0 = 2π*fc/fs
 *
 * @module  digital-filter/resonator
 */

let {cos, PI} = Math

export default function resonator (data, params) {
	let fc = params.fc, fs = params.fs || 44100
	let bw = params.bw || 50

	// Recompute coefficients if params changed
	if (params._fc !== fc || params._bw !== bw) {
		let R = 1 - PI * bw / fs
		let w0 = 2 * PI * fc / fs
		params._a1 = -2 * R * cos(w0)
		params._a2 = R * R
		params._gain = 1 - R * R
		params._fc = fc
		params._bw = bw
	}

	let a1 = params._a1, a2 = params._a2, gain = params._gain
	let y1 = params.y1 != null ? params.y1 : 0
	let y2 = params.y2 != null ? params.y2 : 0

	for (let i = 0, l = data.length; i < l; i++) {
		let y = gain * data[i] - a1 * y1 - a2 * y2
		y2 = y1
		y1 = y
		data[i] = y
	}

	params.y1 = y1
	params.y2 = y2

	return data
}
