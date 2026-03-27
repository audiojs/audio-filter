let {PI, tan, cos, sin, sqrt} = Math

export default function cWeighting(fs) {
	if (!fs) fs = 44100

	// IEC 61672 C-weighting analog prototype
	// H(s) = K * s^2 / ((s+w1)^2 * (s+w4)^2)
	// 2 zeros at DC, double poles at 20.6 Hz and 12194 Hz
	let f1 = 20.598997, f4 = 12194.217
	let C = 2 * fs

	let w1 = prewarp(f1, fs), w4 = prewarp(f4, fs)

	// Section 1: s^2 / (s+w1)^2 — double-pole HPF at 20.6 Hz
	let s1 = hpDouble(w1, C)

	// Section 2: w4^2 / (s+w4)^2 — double-pole LPF at 12194 Hz
	let s2 = lpDouble(w4, C)

	// Normalize to 0 dB at 1 kHz
	let g = evalMag([s1, s2], 1000 / fs)
	s1.b0 /= g; s1.b1 /= g; s1.b2 /= g

	return [s1, s2]
}

function prewarp(f, fs) {
	return 2 * fs * tan(PI * f / fs)
}

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
