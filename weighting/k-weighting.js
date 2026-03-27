import { highshelf, highpass } from 'digital-filter/iir/biquad.js'

export default function kWeighting(fs) {
	if (!fs) fs = 48000

	// ITU-R BS.1770 K-weighting: two cascaded biquad stages

	// Stage 1: high-shelf filter (head-related, ~+4dB above ~1.5kHz)
	// Stage 2: RLB highpass (~38Hz, 2nd-order Butterworth)

	// Exact coefficients from ITU-R BS.1770-4 for 48kHz
	if (fs === 48000) return [
		{
			b0: 1.53512485958697,
			b1: -2.69169618940638,
			b2: 1.19839281085285,
			a1: -1.69065929318241,
			a2: 0.73248077421585
		},
		{
			b0: 1.0,
			b1: -2.0,
			b2: 1.0,
			a1: -1.99004745483398,
			a2: 0.99007225036621
		}
	]

	// For other sample rates, approximate via biquad design
	// Stage 1: high shelf, +4dB above ~1500Hz
	// Stage 2: 2nd-order highpass at ~38Hz (Q = 1/sqrt(2) for Butterworth)
	return [
		highshelf(1681, 0.7072, fs, 3.9997),
		highpass(38, 0.7072, fs)
	]
}
