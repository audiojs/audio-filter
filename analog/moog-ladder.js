/**
 * Moog 4-pole transistor ladder filter (-24 dB/oct lowpass with resonance).
 * Zero-delay feedback (ZDF) via trapezoidal integration.
 *
 * Ref: Zavalishin, "The Art of VA Filter Design" (2012), Ch. 6.
 *      Välimäki & Smith, "Discrete-Time Synthesis of the Moog VCF" (2006).
 *
 * 4 cascaded one-pole trapezoidal integrators with implicit feedback solving.
 * No unit delay in feedback path — resonance tracks cutoff accurately to Nyquist.
 *
 * @module  digital-filter/moog-ladder
 * @param {Float32Array|Float64Array} data - audio buffer (modified in place)
 * @param {Object} params
 * @param {number} [params.fc=1000] - cutoff frequency Hz
 * @param {number} [params.resonance=0] - resonance 0–1 (self-oscillation at 1)
 * @param {number} [params.fs=44100] - sample rate
 * @param {number} [params.drive=1] - input drive (saturation amount)
 */

let {tan, tanh, PI, min} = Math

export default function moogLadder (data, params) {
	let fc = params.fc || 1000
	let res = params.resonance != null ? params.resonance : 0
	let fs = params.fs || 44100
	let drive = params.drive || 1

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let G = g / (1 + g)            // one-pole gain factor
	let G2 = G * G, G3 = G2 * G, G4 = G3 * G
	let k = res * 4                // feedback coefficient: 0–4, self-oscillation at 4

	// State: 4 one-pole integrator states
	if (!params._s) params._s = new Float64Array(4)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
		// Estimate output from current state (zero-input response of cascade)
		// S = weighted sum of integrator states propagated through the cascade
		let S = G3 * s[0] + G2 * s[1] + G * s[2] + s[3]

		// Implicit feedback solve: u*(1 + k*G^4) = input - k*S
		let u = (data[i] - k * S) / (1 + k * G4)

		// Nonlinear saturation at input (transistor ladder characteristic)
		u = tanh(u * drive)

		// 4 cascaded trapezoidal one-pole lowpass stages
		let v = u
		for (let j = 0; j < 4; j++) {
			let y = G * (v - s[j]) + s[j]   // trapezoidal integrator output
			s[j] = 2 * y - s[j]             // state update (2y - s for trapezoidal rule)
			v = y
		}

		data[i] = v
	}

	return data
}
