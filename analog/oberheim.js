/**
 * Oberheim SEM state-variable filter (–12 dB/oct multimode).
 * Zero-delay feedback (ZDF) via trapezoidal integration.
 *
 * Ref: Zavalishin, "The Art of VA Filter Design" (2012), Ch. 4–5.
 *
 * 2-pole SVF with continuous mode selection (lowpass, highpass, bandpass, notch).
 * Two trapezoidal integrators with tanh saturation in the feedback path
 * give the warm, musical character of the original SEM hardware.
 *
 * @module  digital-filter/oberheim
 * @param {Float32Array|Float64Array} data - audio buffer (modified in place)
 * @param {Object} params
 * @param {number} [params.fc=1000] - cutoff frequency Hz
 * @param {number} [params.resonance=0] - resonance 0–1 (max resonance at 1)
 * @param {number} [params.fs=44100] - sample rate
 * @param {string} [params.type='lowpass'] - 'lowpass'|'highpass'|'bandpass'|'notch'
 */

let {tan, tanh, PI, min} = Math

export default function oberheim (data, params) {
	let fc = params.fc || 1000
	let res = params.resonance != null ? params.resonance : 0
	let fs = params.fs || 44100
	let type = params.type || 'lowpass'

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let R = 1 - res               // damping: 1 = no resonance, 0 = max resonance

	// State: 2 integrator states (bandpass, lowpass)
	if (!params._s) params._s = new Float64Array(2)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
		// Implicit solve for highpass (ZDF: no unit delay in feedback)
		let hp = (data[i] - 2 * R * s[0] - g * s[0] - s[1]) / (1 + 2 * R * g + g * g)

		// Bandpass integrator (trapezoidal)
		let bp = g * hp + s[0]
		s[0] = g * hp + bp

		// Lowpass integrator (trapezoidal)
		let lp = g * bp + s[1]
		s[1] = g * bp + lp

		// Saturate feedback states (analog character)
		s[0] = tanh(s[0])
		s[1] = tanh(s[1])

		// Mode select
		data[i] = type === 'bandpass' ? bp
			: type === 'highpass' ? hp
			: type === 'notch' ? hp + lp
			: lp
	}

	return data
}
