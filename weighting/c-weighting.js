import dfFilter from 'digital-filter/core/filter.js'
import matchedZ from 'digital-filter/core/matched-z.js'

let { PI } = Math

export default function cWeighting(data, params = {}) {
	let fs = params.fs || 44100
	if (!params._sos || params._fs !== fs) {
		params._fs = fs
		params._sos = cWeighting.coefs(fs)
	}
	if (!params.state) params.state = params._sos.map(() => [0, 0])
	return dfFilter(data, { coefs: params._sos, state: params.state })
}

cWeighting.coefs = function coefs(fs = 44100) {
	// IEC 61672-1:2013 C-weighting: H(s) = K·s² / ((s+w1)²(s+w4)²)
	let f1 = 20.598997, f4 = 12194.217
	let w = f => 2 * PI * f
	return matchedZ(
		[-w(f1), -w(f1), -w(f4), -w(f4)],
		[0, 0],
		fs,
		1000
	)
}
