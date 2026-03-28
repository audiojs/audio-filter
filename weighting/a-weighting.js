import dfFilter from 'digital-filter/core/filter.js'

let {PI, tan, cos, sin, sqrt} = Math

export default function aWeighting(data, params = {}) {
	let fs = params.fs || 44100
	if (!params._sos || params._fs !== fs) {
		params._fs = fs
		params._sos = aWeighting.coefs(fs)
	}
	if (!params.state) params.state = params._sos.map(() => [0, 0])
	return dfFilter(data, { coefs: params._sos, state: params.state })
}

aWeighting.coefs = function coefs(fs = 44100) {
	// IEC 61672 analog prototype frequencies (Hz)
	let f1 = 20.598997, f2 = 107.65265, f3 = 737.86223, f4 = 12194.217
	let C = 2 * fs

	let w1 = prewarp(f1, fs), w2 = prewarp(f2, fs)
	let w3 = prewarp(f3, fs), w4 = prewarp(f4, fs)

	// H(s) = K * s^4 / ((s+w1)^2 * (s+w2) * (s+w3) * (s+w4)^2)
	// 3 biquad sections: double-pole HPF, mixed-pole HPF, double-pole LPF
	let s1 = hpDouble(w1, C)
	let s2 = hpPair(w2, w3, C)
	let s3 = lpDouble(w4, C)

	// Normalize to 0 dB at 1 kHz
	let g = evalMag([s1, s2, s3], 1000 / fs)
	s1.b0 /= g; s1.b1 /= g; s1.b2 /= g

	return [s1, s2, s3]
}

function prewarp(f, fs) {
	return 2 * fs * tan(PI * f / fs)
}

// s^2 / (s + w)^2 via bilinear transform
// num: C^2(1 - z^-1)^2, den: ((C+w) + (w-C)z^-1)^2
function hpDouble(w, C) {
	let a = C + w, b = w - C
	let d0 = a * a
	return {
		b0: C * C / d0,
		b1: -2 * C * C / d0,
		b2: C * C / d0,
		a1: 2 * a * b / d0,
		a2: b * b / d0
	}
}

// s^2 / ((s+wa)(s+wb)) via bilinear transform
// den polynomial: s^2 + (wa+wb)s + wa*wb
function hpPair(wa, wb, C) {
	let wsum = wa + wb, wprod = wa * wb, C2 = C * C
	let d0 = C2 + wsum * C + wprod
	return {
		b0: C2 / d0,
		b1: -2 * C2 / d0,
		b2: C2 / d0,
		a1: (-2 * C2 + 2 * wprod) / d0,
		a2: (C2 - wsum * C + wprod) / d0
	}
}

// w^2 / (s + w)^2 via bilinear transform
// num: w^2(1 + z^-1)^2, den: ((C+w) + (w-C)z^-1)^2
function lpDouble(w, C) {
	let a = C + w, b = w - C, w2 = w * w
	let d0 = a * a
	return {
		b0: w2 / d0,
		b1: 2 * w2 / d0,
		b2: w2 / d0,
		a1: 2 * a * b / d0,
		a2: b * b / d0
	}
}

// Evaluate combined magnitude at normalized frequency fNorm = f/fs
function evalMag(sections, fNorm) {
	let w = 2 * PI * fNorm
	let cosw = cos(w), sinw = sin(w)
	let cos2w = cos(2 * w), sin2w = sin(2 * w)
	let mag = 1
	for (let c of sections) {
		let br = c.b0 + c.b1 * cosw + c.b2 * cos2w
		let bi = -c.b1 * sinw - c.b2 * sin2w
		let ar = 1 + c.a1 * cosw + c.a2 * cos2w
		let ai = -c.a1 * sinw - c.a2 * sin2w
		mag *= sqrt((br * br + bi * bi) / (ar * ar + ai * ai))
	}
	return mag
}
