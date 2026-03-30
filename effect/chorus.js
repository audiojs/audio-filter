/**
 * Chorus — multiple detuned delay lines for ensemble thickening
 *
 * @module  audio-filter/effect/chorus
 */

let {sin, floor, PI} = Math

export default function chorus (data, params) {
	let rate = params.rate == null ? 1.5 : params.rate
	let depth = params.depth == null ? 0.5 : params.depth
	let delay = params.delay == null ? 20 : params.delay
	let voices = params.voices || 3
	let fs = params.fs || 44100

	let maxDelay = (delay * 2 * fs / 1000) | 0
	let delaySamples = delay * fs / 1000

	if (!params.buffer || params.buffer.length < maxDelay) {
		params.buffer = new Float64Array(maxDelay)
		params.ptr = 0
		params._phases = new Float64Array(voices)
		for (let v = 0; v < voices; v++) params._phases[v] = v / voices * 2 * PI
	}
	let buf = params.buffer, ptr = params.ptr, phases = params._phases
	let inc = 2 * PI * rate / fs

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		buf[ptr] = x

		let wet = 0
		for (let v = 0; v < voices; v++) {
			let d = delaySamples * (1 + depth * sin(phases[v]))
			phases[v] += inc
			if (phases[v] > 2 * PI) phases[v] -= 2 * PI

			let readPos = ptr - d
			if (readPos < 0) readPos += maxDelay

			let idx = floor(readPos)
			let frac = readPos - idx
			let a = buf[idx % maxDelay]
			let b = buf[(idx + 1) % maxDelay]
			wet += a + frac * (b - a)
		}

		ptr = (ptr + 1) % maxDelay
		data[i] = (x + wet / voices) * 0.5
	}

	params.ptr = ptr

	return data
}
