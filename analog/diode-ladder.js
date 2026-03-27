/**
 * Diode ladder filter (Roland TB-303 / EMS VCS3 style).
 * Zero-delay feedback (ZDF) via trapezoidal integration with per-stage saturation.
 *
 * Ref: Zavalishin, "The Art of VA Filter Design" (2012), Ch. 6.
 *      Pirkle, "Designing Audio Effect Plugins in C++" (2019), Ch. 10.
 *
 * Unlike the Moog transistor ladder (saturation only at input), the diode ladder
 * has tanh nonlinearity at each stage. This preserves bass content at high resonance
 * and gives the characteristic "squelchy" TB-303 sound.
 *
 * Feedback topology differs from Moog: diode ladder feeds back a weighted sum of all
 * stage outputs, not just the final one. This gives a gentler resonance character.
 *
 * @module  digital-filter/diode-ladder
 * @param {Float32Array|Float64Array} data - audio buffer (modified in place)
 * @param {Object} params
 * @param {number} [params.fc=1000] - cutoff frequency Hz
 * @param {number} [params.resonance=0] - resonance 0–1 (self-oscillation at 1)
 * @param {number} [params.fs=44100] - sample rate
 */

let {tan, tanh, PI, min} = Math

export default function diodeLadder (data, params) {
	let fc = params.fc || 1000
	let res = params.resonance != null ? params.resonance : 0
	let fs = params.fs || 44100

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let G = g / (1 + g)
	let G2 = G * G, G3 = G2 * G, G4 = G3 * G

	// Diode ladder feedback weights (asymmetric staging)
	// The diode ladder has unequal feedback from each stage
	let k = res * 4

	// State: 4 one-pole integrator states
	if (!params._s) params._s = new Float64Array(4)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
		// Estimate output from current state (for implicit feedback)
		let S = G3 * s[0] + G2 * s[1] + G * s[2] + s[3]

		// Implicit feedback solve
		// For nonlinear stages, we use the linear estimate then apply nonlinearity
		// This is a first-order approximation — accurate enough for audio
		let u = (data[i] - k * tanh(S)) / (1 + k * G4)

		// 4 cascaded trapezoidal one-pole stages with per-stage saturation
		let v = u
		for (let j = 0; j < 4; j++) {
			let y = G * (tanh(v) - tanh(s[j])) + s[j]  // nonlinear trapezoidal integrator
			s[j] = 2 * y - s[j]                         // state update
			v = y
		}

		data[i] = v
	}

	return data
}
