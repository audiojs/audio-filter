import dfFilter from 'digital-filter/core/filter.js'
import { highshelf, highpass } from 'digital-filter/iir/biquad.js'

export default function kWeighting(data, params = {}) {
	let fs = params.fs || 48000
	if (!params._sos || params._fs !== fs) {
		params._fs = fs
		params._sos = kWeighting.coefs(fs)
	}
	if (!params.state) params.state = params._sos.map(() => [0, 0])
	return dfFilter(data, { coefs: params._sos, state: params.state })
}

kWeighting.coefs = function coefs(fs = 48000) {
	// ITU-R BS.1770 K-weighting: high-shelf + RLB highpass

	// Exact coefficients from ITU-R BS.1770-4 for 48kHz
	if (fs === 48000) return [
		{ b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 },
		{ b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.99004745483398, a2: 0.99007225036621 }
	]

	// For other sample rates, approximate via biquad design
	return [
		highshelf(1681, 0.7072, fs, 3.9997),
		highpass(38, 0.7072, fs)
	]
}
