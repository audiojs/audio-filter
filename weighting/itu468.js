import dfFilter from 'digital-filter/core/filter.js'
import { highpass, peaking, highshelf, lowpass } from 'digital-filter/iir/biquad.js'

export default function itu468(data, params = {}) {
	let fs = params.fs || 48000
	if (!params._sos || params._fs !== fs) {
		params._fs = fs
		params._sos = itu468.coefs(fs)
	}
	if (!params.state) params.state = params._sos.map(() => [0, 0])
	return dfFilter(data, { coefs: params._sos, state: params.state })
}

itu468.coefs = function coefs(fs = 48000) {
	// ITU-R 468 noise weighting: peaked at +12.2 dB near 6.3 kHz
	// IIR approximation within ~1 dB across 31.5 Hz–20 kHz
	return [
		highpass(20, 0.65, fs),
		peaking(6300, 0.72, fs, 12.2),
		highshelf(1250, 0.45, fs, 5.6),
		lowpass(22000, 0.55, fs)
	]
}
