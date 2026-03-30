/**
 * Wah-wah — swept resonant bandpass filter
 *
 * @module  audio-filter/effect/wah
 */

let {sin, pow, PI} = Math

export default function wah (data, params) {
	let rate = params.rate == null ? 1.5 : params.rate
	let depth = params.depth == null ? 0.8 : params.depth
	let fc = params.fc || 1000
	let Q = params.Q == null ? 5 : params.Q
	let fs = params.fs || 44100
	let mode = params.mode || 'auto'

	if (params._lp == null) {
		params._lp = 0
		params._bp = 0
		params._phase = 0
	}
	let lp = params._lp, bp = params._bp, phase = params._phase
	let inc = 2 * PI * rate / fs
	let q = 1 / Q

	for (let i = 0, l = data.length; i < l; i++) {
		let freq
		if (mode === 'auto') {
			let lfo = sin(phase)
			phase += inc
			if (phase > 2 * PI) phase -= 2 * PI
			freq = fc * pow(2, depth * lfo)
		} else {
			freq = fc
		}

		let f = 2 * sin(PI * freq / fs)
		let x = data[i]
		lp += f * bp
		let hp = x - lp - q * bp
		bp += f * hp
		data[i] = bp
	}

	params._lp = lp
	params._bp = bp
	params._phase = phase

	return data
}
