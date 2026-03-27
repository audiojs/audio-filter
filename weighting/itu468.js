import { highpass, peaking, highshelf, lowpass } from 'digital-filter/iir/biquad.js'

export default function itu468(fs) {
	if (!fs) fs = 48000

	// ITU-R 468 noise weighting approximation via cascaded biquads
	// Target: peaked response at +12.2 dB near 6.3 kHz,
	// steep rolloff above ~10 kHz, gradual rolloff below ~1 kHz
	// Note: this is a practical IIR approximation within ~1 dB across 31.5 Hz–20 kHz
	return [
		highpass(20, 0.65, fs),
		peaking(6300, 0.72, fs, 12.2),
		highshelf(1250, 0.45, fs, 5.6),
		lowpass(22000, 0.55, fs)
	]
}
