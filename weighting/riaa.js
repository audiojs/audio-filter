let {PI, tan, cos, sin, sqrt} = Math

export default function riaa(fs) {
	if (!fs) fs = 44100

	// RIAA playback (de-emphasis) equalization
	// H(s) = (1 + s*T2) / ((1 + s*T1) * (1 + s*T3))
	// Time constants → corner frequencies
	let T1 = 3180e-6, T2 = 318e-6, T3 = 75e-6
	let fp1 = 1 / (2 * PI * T1)   // 50.05 Hz  (pole)
	let fz  = 1 / (2 * PI * T2)   // 500.5 Hz  (zero)
	let fp2 = 1 / (2 * PI * T3)   // 2122 Hz   (pole)

	// Prewarp analog corner frequencies
	let Wp1 = prewarp(fp1, fs)
	let Wz  = prewarp(fz, fs)
	let Wp2 = prewarp(fp2, fs)
	let C = 2 * fs

	// Bilinear transform: s = C(1-z^-1)/(1+z^-1)
	// num: C(1-z^-1) + Wz(1+z^-1) = (C+Wz) + (Wz-C)z^-1
	// den: ((C+Wp1) + (Wp1-C)z^-1) * ((C+Wp2) + (Wp2-C)z^-1)
	let n0 = C + Wz
	let n1 = Wz - C

	let d0 = (C + Wp1) * (C + Wp2)
	let d1 = (C + Wp1) * (Wp2 - C) + (Wp1 - C) * (C + Wp2)
	let d2 = (Wp1 - C) * (Wp2 - C)

	let s1 = {
		b0: n0 / d0,
		b1: n1 / d0,
		b2: 0,
		a1: d1 / d0,
		a2: d2 / d0
	}

	// Normalize to 0 dB at 1 kHz
	let g = evalMag([s1], 1000 / fs)
	s1.b0 /= g; s1.b1 /= g

	return [s1]
}

function prewarp(f, fs) {
	return 2 * fs * tan(PI * f / fs)
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
