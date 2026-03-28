import dfFilter from 'digital-filter/core/filter.js'
import matchedZ from 'digital-filter/core/matched-z.js'

let { PI } = Math

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
	// IEC 61672-1:2013 analog prototype frequencies
	let f1 = 20.598997, f2 = 107.65265, f3 = 737.86223, f4 = 12194.217
	let w = f => 2 * PI * f
	// H(s) = K·s⁴ / ((s+w1)²(s+w2)(s+w3)(s+w4)²)
	return matchedZ(
		[-w(f1), -w(f1), -w(f2), -w(f3), -w(f4), -w(f4)],
		[0, 0, 0, 0],
		fs,
		1000
	)
}
