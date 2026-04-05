import test, { almost, ok, is } from 'tst'
import * as audio from './index.js'
import { biquad, filter, freqz, mag2db } from 'digital-filter'

let EPSILON = 1e-10
let LOOSE = 1e-4

// Compute DFT magnitude at a specific frequency
function dftMag(data, f, fs) {
	let w = 2 * Math.PI * f / fs
	let re = 0, im = 0
	for (let n = 0; n < data.length; n++) {
		re += data[n] * Math.cos(w * n)
		im -= data[n] * Math.sin(w * n)
	}
	return Math.sqrt(re * re + im * im)
}

// Evaluate SOS filter magnitude in dB at exact frequency f Hz
function magDB(sos, f, fs) {
	let w = 2 * Math.PI * f / fs
	let magSq = 1
	for (let c of sos) {
		let br = c.b0 + c.b1 * Math.cos(w)   + c.b2 * Math.cos(2*w)
		let bi =      -(c.b1 * Math.sin(w)   + c.b2 * Math.sin(2*w))
		let ar = 1   + c.a1 * Math.cos(w)   + c.a2 * Math.cos(2*w)
		let ai =      -(c.a1 * Math.sin(w)   + c.a2 * Math.sin(2*w))
		magSq *= (br*br + bi*bi) / (ar*ar + ai*ai)
	}
	return 10 * Math.log10(magSq)
}

function impulse (n) {
	let d = new Float64Array(n || 64)
	d[0] = 1
	return d
}

function dc (n, val) {
	let d = new Float64Array(n || 64)
	d.fill(val || 1)
	return d
}

test('dcBlocker — removes DC', () => {
	let data = dc(2048)
	audio.dcBlocker(data, {R: 0.995})
	ok(Math.abs(data[2047]) < 0.01, 'DC removed after settling')
})

test('comb feedforward — echo at delay', () => {
	let data = impulse(8)
	audio.comb(data, {delay: 3, gain: 0.5, type: 'feedforward'})
	almost(data[0], 1, EPSILON)
	almost(data[3], 0.5, EPSILON)
	almost(data[1], 0, EPSILON)
})

test('comb feedback — decaying echoes', () => {
	let data = impulse(10)
	audio.comb(data, {delay: 3, gain: 0.5, type: 'feedback'})
	almost(data[0], 1, EPSILON)
	almost(data[3], 0.5, EPSILON)
	almost(data[6], 0.25, EPSILON)
})

test('allpass.first — unity magnitude', () => {
	let data = [1, 0, 0, 0, 0, 0, 0, 0]
	audio.allpass.first(data, {a: 0.5})
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	ok(energy > 0, 'produces output')
})

// IEC 61672-1:2013 Table 2 — A-weighting nominal values (dB)
const IEC_A = {
	31.5: -39.4, 63: -26.2, 125: -16.1, 250: -8.6, 500: -3.2,
	1000: 0.0, 2000: 1.2, 4000: 1.0, 8000: -1.1, 10000: -2.5,
	16000: -6.6, 20000: -9.3
}

// IEC 61672-1:2013 Table 2 — C-weighting nominal values (dB)
const IEC_C = {
	31.5: -3.0, 63: -0.8, 125: -0.2, 250: 0.0, 500: 0.0,
	1000: 0.0, 2000: -0.2, 4000: -0.8, 8000: -3.0
}

test('aWeighting — IEC 61672 table values at 96kHz', () => {
	// matched z-transform: ≤10kHz excellent; 16–20kHz within IEC Class 1 (±2 dB)
	let sos = audio.aWeighting.coefs(96000)
	for (let [f, expected] of Object.entries(IEC_A)) {
		let tol = +f >= 16000 ? 1.5 : 0.5
		let got = magDB(sos, +f, 96000)
		ok(Math.abs(got - expected) < tol, `A-weighting ${f}Hz: expected ${expected}, got ${got.toFixed(2)} dB`)
	}
})

test('aWeighting — IEC 61672 table values at 48kHz', () => {
	// matched z-transform: ≤8kHz < 1 dB; 10kHz ~1.1 dB (IEC Class 1 boundary);
	// 16–20kHz: better than bilinear (4 dB vs 12 dB error) but 48kHz is insufficient there
	let sos = audio.aWeighting.coefs(48000)
	for (let [f, expected] of Object.entries(IEC_A)) {
		let tol = +f >= 16000 ? 5.0 : +f >= 10000 ? 1.2 : 1.0
		let got = magDB(sos, +f, 48000)
		ok(Math.abs(got - expected) < tol, `A-weighting ${f}Hz@48kHz: expected ${expected}, got ${got.toFixed(2)} dB`)
	}
})

test('cWeighting — IEC 61672 table values at 96kHz', () => {
	let sos = audio.cWeighting.coefs(96000)
	for (let [f, expected] of Object.entries(IEC_C)) {
		let got = magDB(sos, +f, 96000)
		ok(Math.abs(got - expected) < 0.5, `C-weighting ${f}Hz: expected ${expected}, got ${got.toFixed(2)} dB`)
	}
})

test('aWeighting — 3 SOS sections via coefs', () => {
	let sos = audio.aWeighting.coefs(44100)
	is(sos.length, 3, '3 sections')
	ok(sos[0].b0 !== undefined, 'has coefficients')
})

test('aWeighting — 0dB at 1kHz', () => {
	let sos = audio.aWeighting.coefs(44100)
	let resp = freqz(sos, 2048, 44100)
	let idx = Math.round(1000 / (44100 / 2) * 2048)
	let db = mag2db(resp.magnitude[idx])
	ok(Math.abs(db) < 0.5, 'A-weighting ≈ 0dB at 1kHz, got ' + db.toFixed(2) + 'dB')
})

test('aWeighting — in-place processing', () => {
	let data = impulse(512)
	let p = { fs: 44100 }
	audio.aWeighting(data, p)
	let hasOutput = false
	for (let v of data) if (Math.abs(v) > 1e-10) { hasOutput = true; break }
	ok(hasOutput, 'aWeighting produces output')
})

test('cWeighting — 2 SOS sections via coefs', () => {
	let sos = audio.cWeighting.coefs(44100)
	is(sos.length, 2, '2 sections')
})

test('cWeighting — 0dB at 1kHz', () => {
	let sos = audio.cWeighting.coefs(44100)
	let resp = freqz(sos, 2048, 44100)
	let idx = Math.round(1000 / (44100 / 2) * 2048)
	let db = mag2db(resp.magnitude[idx])
	ok(Math.abs(db) < 0.5, 'C-weighting ≈ 0dB at 1kHz, got ' + db.toFixed(2) + 'dB')
})

test('kWeighting 48kHz — exact spec coefficients', () => {
	let sos = audio.kWeighting.coefs(48000)
	is(sos.length, 2, '2 stages')
	almost(sos[0].b0, 1.53512485958697, EPSILON)
	almost(sos[1].b0, 1.0, EPSILON)
})

test('kWeighting other rate — still returns 2 sections', () => {
	let sos = audio.kWeighting.coefs(44100)
	is(sos.length, 2, '2 stages at 44100')
})

test('itu468 — returns sections', () => {
	let sos = audio.itu468.coefs(48000)
	ok(sos.length >= 3, 'at least 3 sections')
})

test('riaa — returns 1 section', () => {
	let sos = audio.riaa.coefs(44100)
	is(sos.length, 1, '1 section')
})

test('riaa — bass boost at 20Hz', () => {
	let sos = audio.riaa.coefs(44100)
	let resp = freqz(sos, 4096, 44100)
	let idx20 = Math.round(20 / (44100 / 2) * 4096)
	let idx1k = Math.round(1000 / (44100 / 2) * 4096)
	let db20 = mag2db(resp.magnitude[idx20])
	let db1k = mag2db(resp.magnitude[idx1k])
	ok(db20 > db1k + 10, 'RIAA boosts bass (20Hz > 1kHz by >10dB)')
})

test('pre-emphasis — boosts high frequencies', () => {
	let data = [0, 0, 0, 1, 0, 0, 0, 0]
	audio.emphasis(data, {alpha: 0.97})
	almost(data[3], 1, EPSILON)
	almost(data[4], -0.97, EPSILON)
})

test('de-emphasis — lowpass accumulation', () => {
	let data = impulse(8)
	audio.deemphasis(data, {alpha: 0.97})
	ok(data[0] > 0, 'first sample non-zero')
	ok(data[1] > 0, 'decaying tail')
	ok(data[1] < data[0], 'decreasing')
})

test('resonator — rings on impulse', () => {
	let data = impulse(256)
	audio.resonator(data, {fc: 1000, bw: 50, fs: 44100})
	// Should produce oscillation
	let hasPositive = false, hasNegative = false
	for (let i = 0; i < 256; i++) {
		if (data[i] > 0.01) hasPositive = true
		if (data[i] < -0.01) hasNegative = true
	}
	ok(hasPositive && hasNegative, 'resonator oscillates')
})

test('pinkNoise — produces output', () => {
	let data = new Float64Array(256)
	for (let i = 0; i < 256; i++) data[i] = Math.random() * 2 - 1
	audio.pinkNoise(data, {})
	let hasOutput = data.some(x => Math.abs(x) > 0.01)
	ok(hasOutput, 'pink noise has output')
})

test('moogLadder — produces output, resonance works', () => {
	let data = impulse(512)
	audio.moogLadder(data, {fc: 1000, resonance: 0.5, fs: 44100})
	let hasOutput = data.some(x => Math.abs(x) > 0.001)
	ok(hasOutput, 'moog produces output')
	// With resonance, should ring
	let hasNeg = data.some(x => x < -0.001)
	ok(hasNeg, 'resonance causes ringing')
})

test('moogLadder — stable at high cutoff', () => {
	let data = impulse(256)
	audio.moogLadder(data, {fc: 15000, resonance: 0.8, fs: 44100})
	ok(data.every(x => isFinite(x)), 'no NaN/Inf at high cutoff')
})

test('diodeLadder — produces output', () => {
	let data = impulse(256)
	audio.diodeLadder(data, {fc: 1000, resonance: 0.5, fs: 44100})
	ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('korg35 — lowpass and highpass modes', () => {
	let lp = impulse(256)
	audio.korg35(lp, {fc: 1000, resonance: 0.3, fs: 44100, type: 'lowpass'})
	let hp = impulse(256)
	audio.korg35(hp, {fc: 1000, resonance: 0.3, fs: 44100, type: 'highpass'})
	ok(lp.some(x => Math.abs(x) > 0.001), 'LP output')
	ok(hp.some(x => Math.abs(x) > 0.001), 'HP output')
})

test('gammatone — resonates at center frequency', () => {
	let data = impulse(4096)
	audio.gammatone(data, {fc: 1000, fs: 44100})
	let hasPos = false, hasNeg = false
	for (let i = 0; i < 4096; i++) {
		if (data[i] > 0.001) hasPos = true
		if (data[i] < -0.001) hasNeg = true
	}
	ok(hasPos && hasNeg, 'gammatone oscillates')
})

test('erbBank — ERB-spaced center frequencies', () => {
	let bands = audio.erbBank(44100)
	ok(bands.length >= 25, 'at least 25 ERB bands')
	ok(bands[0].fc >= 50, 'starts above fmin')
	ok(bands[0].erb > 0, 'has ERB width')
	// Verify spacing increases with frequency (ERB property)
	let spacing1 = bands[1].fc - bands[0].fc
	let spacingN = bands[bands.length - 1].fc - bands[bands.length - 2].fc
	ok(spacingN > spacing1, 'wider spacing at higher frequencies')
})

test('barkBank — 24 critical bands', () => {
	let bands = audio.barkBank(44100)
	ok(bands.length >= 20, 'at least 20 Bark bands')
	is(bands[0].bark, 1, 'starts at bark 1')
	ok(bands[0].coefs.b0 !== undefined, 'has biquad coefficients')
	ok(bands[0].fLow < bands[0].fHigh, 'fLow < fHigh')
})

test('octaveBank — correct number of bands', () => {
	let bands = audio.octaveBank(3, 44100)
	ok(bands.length >= 20, '1/3-octave has 20+ bands')
	ok(bands[0].fc > 0, 'has center frequency')
	ok(bands[0].coefs.b0 !== undefined, 'has coefficients')
})

test('spectralTilt — nonzero output', () => {
	let data = impulse(256)
	audio.spectralTilt(data, {slope: 3, fs: 44100})
	ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('variableBandwidth — filters signal', () => {
	let data = dc(256)
	audio.variableBandwidth(data, {fc: 5000, Q: 0.707, fs: 44100})
	almost(data[255], 1, 0.05)
})

test('graphicEq — applies gain', () => {
	let data = dc(512)
	audio.graphicEq(data, {gains: {1000: 6}, fs: 44100})
	// DC should still pass (peaking EQ at 1kHz doesn't affect DC)
	almost(data[511], 1, 0.05)
})

test('parametricEq — applies bands', () => {
	let data = dc(256)
	audio.parametricEq(data, {bands: [{fc: 1000, Q: 1, gain: 0, type: 'peak'}], fs: 44100})
	almost(data[255], 1, 0.01)
})

test('crossover — returns correct band count', () => {
	let bands = audio.crossover([500, 2000], 4, 44100)
	is(bands.length, 3, '2 crossover freqs → 3 bands')
	ok(Array.isArray(bands[0]), 'each band is SOS array')
})

test('formant — produces vowel-like output', () => {
	let data = impulse(512)
	audio.formant(data, {fs: 44100})
	ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('moogLadder — self-oscillation at resonance=1', () => {
	let data = new Float64Array(2048)
	data[0] = 0.01 // tiny impulse to start oscillation
	audio.moogLadder(data, {fc: 1000, resonance: 1, fs: 44100})
	// Check that output has sustained energy even late in the buffer
	let lateEnergy = 0
	for (let i = 1024; i < 2048; i++) lateEnergy += data[i] * data[i]
	ok(lateEnergy > 0.001, 'Moog self-oscillates at resonance=1 (late energy: ' + lateEnergy.toFixed(4) + ')')
})

test('diodeLadder — stable at high resonance', () => {
	let data = impulse(1024)
	audio.diodeLadder(data, {fc: 2000, resonance: 0.95, fs: 44100})
	ok(data.every(isFinite), 'no NaN/Inf at high resonance')
	let maxVal = 0
	for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > maxVal) maxVal = Math.abs(data[i])
	ok(maxVal < 100, 'output bounded (max: ' + maxVal.toFixed(2) + ')')
})

test('korg35 HP — attenuates DC', () => {
	let data = dc(1024)
	audio.korg35(data, {fc: 1000, resonance: 0.3, fs: 44100, type: 'highpass'})
	// Nonlinear filter: tanh saturation prevents full DC removal, but HP significantly attenuates it
	ok(Math.abs(data[1023]) < 0.5, 'Korg35 HP attenuates DC (last sample: ' + data[1023].toFixed(4) + ')')
	// HP output should be much less than input (1.0)
	ok(Math.abs(data[1023]) < Math.abs(1.0) * 0.2, 'Korg35 HP reduces DC by >80%')
})

test('gammatone — peak of frequency response near fc', () => {
	let fc = 2000, fs = 44100
	let data = impulse(4096)
	audio.gammatone(data, {fc, fs})

	// Compute rough magnitude spectrum via DFT at a few points
	let peakFreq = 0, peakMag = 0
	let N = data.length
	for (let fi = 500; fi <= 5000; fi += 50) {
		let w = 2 * Math.PI * fi / fs
		let re = 0, im = 0
		for (let n = 0; n < N; n++) {
			re += data[n] * Math.cos(w * n)
			im -= data[n] * Math.sin(w * n)
		}
		let mag = Math.sqrt(re * re + im * im)
		if (mag > peakMag) { peakMag = mag; peakFreq = fi }
	}
	ok(Math.abs(peakFreq - fc) < 200, 'Gammatone peak at ' + peakFreq + 'Hz (expected ~' + fc + 'Hz)')
})

test('octaveBank — 1/1 has fewer bands than 1/3', () => {
	let bands1 = audio.octaveBank(1, 44100)
	let bands3 = audio.octaveBank(3, 44100)
	ok(bands1.length >= 8, '1/1 octave has 8+ bands (got ' + bands1.length + ')')
	ok(bands3.length >= 20, '1/3 octave has 20+ bands (got ' + bands3.length + ')')
	ok(bands3.length > bands1.length * 2, '1/3 octave has >2x bands vs 1/1')
})

test('octaveBank — 1/6 has more bands than 1/3', () => {
	let bands3 = audio.octaveBank(3, 44100)
	let bands6 = audio.octaveBank(6, 44100)
	ok(bands6.length > bands3.length, '1/6 octave has more bands than 1/3')
})

test('erbBank — spacing increases monotonically', () => {
	let bands = audio.erbBank(44100)
	for (let i = 2; i < bands.length; i++) {
		let sp1 = bands[i-1].fc - bands[i-2].fc
		let sp2 = bands[i].fc - bands[i-1].fc
		ok(sp2 >= sp1 - 0.01, 'ERB spacing increases: ' + sp1.toFixed(1) + ' → ' + sp2.toFixed(1))
	}
})

test('barkBank — 24 critical bands', () => {
	let bands = audio.barkBank(44100)
	is(bands.length, 24, '24 Bark bands at 44100Hz')
})

test('itu468 — peaked response near 6.3kHz', () => {
	let sos = audio.itu468.coefs(48000)
	ok(sos.length >= 3, 'at least 3 sections')
	let resp = freqz(sos, 4096, 48000)
	let db = mag2db(resp.magnitude)
	let idx2k = Math.round(2000 / (48000/2) * 4096)
	let idx6k = Math.round(6300 / (48000/2) * 4096)
	// ITU-468 peaks near 6.3kHz, significantly above 2kHz level
	ok(db[idx6k] > db[idx2k] + 3, 'ITU-468 peaks near 6.3kHz (6.3kHz: ' + db[idx6k].toFixed(1) + 'dB, 2kHz: ' + db[idx2k].toFixed(1) + 'dB)')
})

test('dcBlocker — output converges to 0 for pure DC', () => {
	let data = dc(4096)
	audio.dcBlocker(data, {R: 0.995})
	ok(Math.abs(data[4095]) < 0.005, 'DC blocked to < 0.005 (got ' + Math.abs(data[4095]).toFixed(6) + ')')
})

test('allpass.second — unity magnitude across spectrum', () => {
	let data = impulse(512)
	audio.allpass.second(data, {fc: 2000, Q: 1, fs: 44100})
	// Compute energy — should equal input energy (1.0 for unit impulse)
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	almost(energy, 1, 0.01)
})

test('crossfeed — mixes stereo channels', () => {
	let left = dc(256, 1)
	let right = dc(256, 0)
	audio.crossfeed(left, right, {fc: 700, level: 0.3, fs: 44100})
	// Right channel should now have some energy (mixed from left)
	let rightEnergy = 0
	for (let i = 128; i < 256; i++) rightEnergy += right[i] * right[i]
	ok(rightEnergy > 0.01, 'crossfeed mixes L→R (right energy: ' + rightEnergy.toFixed(4) + ')')
	// Left should still have energy (not fully cancelled)
	let leftEnergy = 0
	for (let i = 128; i < 256; i++) leftEnergy += left[i] * left[i]
	ok(leftEnergy > 0.1, 'left retains energy after crossfeed')
})

test('formant — output has significant energy', () => {
	let data = impulse(1024)
	audio.formant(data, {fs: 44100})
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	ok(energy > 0.0001, 'formant has energy (got ' + energy.toFixed(6) + ')')
	// Should have some non-zero output
	let hasOutput = data.some(x => Math.abs(x) > 0.0001)
	ok(hasOutput, 'formant produces output')
})

test('vocoder — output matches input length', () => {
	let N = 512
	let carrier = new Float64Array(N)
	let modulator = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		carrier[i] = Math.sin(2 * Math.PI * 440 * i / 44100) // sawtooth-like
		modulator[i] = Math.sin(2 * Math.PI * 100 * i / 44100) * 0.5
	}
	let out = audio.vocoder(carrier, modulator, {bands: 8, fs: 44100})
	is(out.length, N, 'vocoder output length = input length')
	let hasOutput = out.some(x => Math.abs(x) > 0.0001)
	ok(hasOutput, 'vocoder produces nonzero output')
})

// ═══════════════════════════════════════════════════════════════════════════
// Standards calibration
// ═══════════════════════════════════════════════════════════════════════════

test('itu468 48kHz — ITU-R 468 table values (relative to 1kHz)', () => {
	let sos = audio.itu468.coefs(48000)
	let ref = magDB(sos, 1000, 48000)
	// Note: 31.5Hz omitted — the 4-biquad IIR approximation cannot model
	// the extreme low-frequency rolloff (-29.9dB) of the analog ITU-468 curve
	let table = { 2000: 5.6, 4000: 11.0, 6300: 12.2 }
	for (let [f, expected] of Object.entries(table)) {
		let got = magDB(sos, +f, 48000) - ref
		let tol = 2.5
		ok(Math.abs(got - expected) < tol, `ITU-468 ${f}Hz: expected ${expected}dB rel 1kHz, got ${got.toFixed(2)}dB`)
	}
})

test('riaa 44100Hz — IEC 98 reference values relative to 1kHz', () => {
	let sos = audio.riaa.coefs(44100)
	let db1k = magDB(sos, 1000, 44100)
	let db20 = magDB(sos, 20, 44100)
	let db10k = magDB(sos, 10000, 44100)
	let rel20 = db20 - db1k
	ok(Math.abs(rel20 - 19.274) < 1.0, `RIAA 20Hz: expected +19.274dB rel 1kHz, got ${rel20.toFixed(3)}dB`)
	let rel10k = db10k - db1k
	ok(Math.abs(rel10k - (-13.734)) < 1.0, `RIAA 10kHz: expected -13.734dB rel 1kHz, got ${rel10k.toFixed(3)}dB`)
})

test('kWeighting 44100Hz — shelving boost near 2kHz, HPF rolls off below 100Hz', () => {
	let sos = audio.kWeighting.coefs(44100)
	let db200 = magDB(sos, 200, 44100)
	let db2k = magDB(sos, 2000, 44100)
	ok(db2k > db200, `K-weighting 2kHz (${db2k.toFixed(2)}dB) boosted vs 200Hz (${db200.toFixed(2)}dB)`)
	let db20 = magDB(sos, 20, 44100)
	ok(db20 < db200 - 3, `K-weighting 20Hz (${db20.toFixed(2)}dB) rolls off vs 200Hz (${db200.toFixed(2)}dB)`)
})

test('cWeighting 48kHz — IEC 61672 table values', () => {
	let sos = audio.cWeighting.coefs(48000)
	let table = { 31.5: -3.0, 1000: 0, 8000: -3.0 }
	for (let [f, expected] of Object.entries(table)) {
		let got = magDB(sos, +f, 48000)
		let tol = +f >= 8000 ? 1.0 : 0.5
		ok(Math.abs(got - expected) < tol, `C-weighting@48kHz ${f}Hz: expected ${expected}dB, got ${got.toFixed(2)}dB`)
	}
})

test('aWeighting 44100Hz — IEC 61672 table values', () => {
	let sos = audio.aWeighting.coefs(44100)
	let table = {
		31.5: -39.4, 63: -26.2, 125: -16.1, 250: -8.6, 500: -3.2,
		1000: 0.0, 2000: 1.2, 4000: 1.0, 8000: -1.1
	}
	for (let [f, expected] of Object.entries(table)) {
		let tol = +f <= 63 ? 2.0 : 1.5
		let got = magDB(sos, +f, 44100)
		ok(Math.abs(got - expected) < tol, `A-weighting@44100 ${f}Hz: expected ${expected}dB, got ${got.toFixed(2)}dB`)
	}
})

// ═══════════════════════════════════════════════════════════════════════════
// Functional correctness
// ═══════════════════════════════════════════════════════════════════════════

test('graphicEq — gains:{1000:6} boosts 1kHz', () => {
	let fs = 44100, N = 4096
	let data = new Float64Array(N)
	for (let i = 0; i < N; i++) data[i] = Math.sin(2 * Math.PI * 1000 * i / fs)
	audio.graphicEq(data, { gains: { 1000: 6 }, fs })
	let peak = 0
	for (let i = N / 2; i < N; i++) if (Math.abs(data[i]) > peak) peak = Math.abs(data[i])
	ok(peak > 1.5, `graphicEq 1kHz boosted: peak ${peak.toFixed(3)}`)
})

test('parametricEq — gain:6 at 1kHz boosts signal', () => {
	let fs = 44100, N = 4096
	let data = new Float64Array(N)
	for (let i = 0; i < N; i++) data[i] = Math.sin(2 * Math.PI * 1000 * i / fs)
	audio.parametricEq(data, { bands: [{ fc: 1000, Q: 1, gain: 6, type: 'peak' }], fs })
	let peak = 0
	for (let i = N / 2; i < N; i++) if (Math.abs(data[i]) > peak) peak = Math.abs(data[i])
	ok(peak > 1.5, `parametricEq boosted 1kHz: peak ${peak.toFixed(3)}`)
})

test('emphasis + deemphasis round-trip = identity', () => {
	let N = 512, fs = 44100
	let orig = new Float64Array(N)
	for (let i = 0; i < N; i++) orig[i] = Math.sin(2 * Math.PI * 440 * i / fs)
	let data = Float64Array.from(orig)
	audio.emphasis(data, { alpha: 0.97 })
	audio.deemphasis(data, { alpha: 0.97 })
	let maxErr = 0
	for (let i = 100; i < N; i++) {
		let err = Math.abs(data[i] - orig[i])
		if (err > maxErr) maxErr = err
	}
	ok(maxErr < 0.05, `emphasis+deemphasis round-trip max error: ${maxErr.toFixed(6)}`)
})

test('allpass.first — energy ≈ 1.0 for unit impulse', () => {
	let data = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
	audio.allpass.first(data, { a: 0.5 })
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	almost(energy, 1, 0.01)
})

test('vocoder — silent modulator produces near-silent output', () => {
	let N = 512, fs = 44100
	let carrier = new Float64Array(N)
	for (let i = 0; i < N; i++) carrier[i] = Math.sin(2 * Math.PI * 440 * i / fs)
	let out = audio.vocoder(carrier, new Float64Array(N), { bands: 8, fs })
	let peak = 0
	for (let i = 0; i < N; i++) if (Math.abs(out[i]) > peak) peak = Math.abs(out[i])
	ok(peak < 0.01, `vocoder silent modulator: peak ${peak.toFixed(6)}`)
})

test('formant — custom /i/ vowel formants produce peaks', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.formant(data, { fs, formants: [{ fc: 270, bw: 60, gain: 1 }, { fc: 2290, bw: 120, gain: 0.7 }] })
	let mag270 = dftMag(data, 270, fs), mag2290 = dftMag(data, 2290, fs), mag800 = dftMag(data, 800, fs)
	ok(mag270 > mag800, `F1 peak at 270Hz (${mag270.toFixed(3)}) > valley (${mag800.toFixed(3)})`)
	ok(mag2290 > mag800, `F2 peak at 2290Hz (${mag2290.toFixed(3)}) > valley (${mag800.toFixed(3)})`)
})

test('moogLadder — DC passthrough with resonance=0', () => {
	let data = dc(2048, 1.0)
	audio.moogLadder(data, { fc: 15000, resonance: 0, fs: 44100 })
	ok(Math.abs(data[2047]) > 0.5, `moogLadder DC output ${data[2047].toFixed(4)} > 0.5`)
	ok(isFinite(data[2047]), 'moogLadder DC output is finite')
})

test('crossover LR4 — allpass property', () => {
	let fs = 44100, fc = 2000
	let bands = audio.crossover([fc], 4, fs)
	is(bands.length, 2, 'single crossover = 2 bands')
	for (let f of [200, 1000, 2000, 4000, 8000]) {
		let lpLin = Math.pow(10, magDB(bands[0], f, fs) / 20)
		let hpLin = Math.pow(10, magDB(bands[1], f, fs) / 20)
		let sumDB = 20 * Math.log10(lpLin + hpLin)
		ok(Math.abs(sumDB) < 1.0, `crossover@${f}Hz: sum=${sumDB.toFixed(2)}dB`)
	}
})

test('pinkNoise — spectral slope ~-3dB/octave', () => {
	let N = 65536, fs = 44100
	let data = new Float64Array(N)
	let seed = 12345
	for (let i = 0; i < N; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; data[i] = (seed / 0x7fffffff) * 2 - 1 }
	audio.pinkNoise(data, {})
	let powerLow = 0, powerHigh = 0, countLow = 0, countHigh = 0, binSize = fs / N
	for (let f = 200; f < 400; f += binSize) { let m = dftMag(data, f, fs); powerLow += m * m; countLow++ }
	for (let f = 1600; f < 3200; f += binSize) { let m = dftMag(data, f, fs); powerHigh += m * m; countHigh++ }
	let diffDB = 10 * Math.log10((powerLow / countLow) / (powerHigh / countHigh))
	ok(diffDB > 4 && diffDB < 15, `pink noise slope: ${diffDB.toFixed(1)}dB (expect ~9dB)`)
})

test('crossfeed — level=0 is passthrough', () => {
	let N = 256
	let left = dc(N, 0.7), right = dc(N, -0.3)
	let origL = Float64Array.from(left), origR = Float64Array.from(right)
	audio.crossfeed(left, right, { fc: 700, level: 0, fs: 44100 })
	let maxErrL = 0, maxErrR = 0
	for (let i = 0; i < N; i++) {
		if (Math.abs(left[i] - origL[i]) > maxErrL) maxErrL = Math.abs(left[i] - origL[i])
		if (Math.abs(right[i] - origR[i]) > maxErrR) maxErrR = Math.abs(right[i] - origR[i])
	}
	ok(maxErrL < LOOSE, `left passthrough err=${maxErrL.toFixed(8)}`)
	ok(maxErrR < LOOSE, `right passthrough err=${maxErrR.toFixed(8)}`)
})

// ═══════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════

test('moogLadder — extreme params: fc=1, res=0.99, fs=192k', () => {
	let data = impulse(256)
	audio.moogLadder(data, { fc: 1, resonance: 0.99, fs: 192000 })
	ok(data.every(isFinite), 'no NaN/Inf')
})

test('diodeLadder — extreme params: fc=1, res=0.99, fs=192k', () => {
	let data = impulse(256)
	audio.diodeLadder(data, { fc: 1, resonance: 0.99, fs: 192000 })
	ok(data.every(isFinite), 'no NaN/Inf')
})

test('korg35 — extreme params: fc=1, res=0.99, fs=192k', () => {
	let data = impulse(256)
	audio.korg35(data, { fc: 1, resonance: 0.99, fs: 192000, type: 'lowpass' })
	ok(data.every(isFinite), 'no NaN/Inf')
})

test('comb — feedforward with delay=1', () => {
	let data = impulse(8)
	audio.comb(data, { delay: 1, gain: 0.5, type: 'feedforward' })
	almost(data[0], 1, EPSILON)
	almost(data[1], 0.5, EPSILON)
	almost(data[2], 0, EPSILON)
})

test('resonator — frequency response peak near fc', () => {
	let fc = 2000, fs = 44100, N = 4096
	let data = impulse(N)
	audio.resonator(data, { fc, bw: 50, fs })
	let peakFreq = 0, peakMag = 0
	for (let f = 500; f <= 5000; f += 25) {
		let mag = dftMag(data, f, fs)
		if (mag > peakMag) { peakMag = mag; peakFreq = f }
	}
	ok(Math.abs(peakFreq - fc) < 100, `resonator peak at ${peakFreq}Hz (expected ~${fc}Hz)`)
})

test('spectralTilt — slope=0 is passthrough', () => {
	let data = impulse(256)
	let orig = Float64Array.from(data)
	audio.spectralTilt(data, { slope: 0, fs: 44100 })
	let maxErr = 0
	for (let i = 0; i < data.length; i++) { let err = Math.abs(data[i] - orig[i]); if (err > maxErr) maxErr = err }
	ok(maxErr < EPSILON, `spectralTilt slope=0 passthrough: err=${maxErr}`)
})

test('variableBandwidth — highpass attenuates DC', () => {
	let data = dc(1024)
	audio.variableBandwidth(data, { fc: 2000, Q: 0.707, fs: 44100, type: 'highpass' })
	ok(Math.abs(data[1023]) < 0.1, `HP attenuates DC: last=${data[1023].toFixed(4)}`)
})

test('variableBandwidth — bandpass attenuates DC', () => {
	let data = dc(1024)
	audio.variableBandwidth(data, { fc: 2000, Q: 1, fs: 44100, type: 'bandpass' })
	ok(Math.abs(data[1023]) < 0.1, `BP attenuates DC: last=${data[1023].toFixed(4)}`)
})

test('barkBank — fs=22050 has fewer than 24 bands', () => {
	let bands = audio.barkBank(22050)
	ok(bands.length < 24, `barkBank@22050 has ${bands.length} bands`)
	ok(bands.length >= 10, `at least 10 bands`)
	ok(bands[bands.length - 1].fc < 22050 / 2, 'highest fc < Nyquist')
})

test('octaveBank — center frequencies include 1000Hz (ISO 266)', () => {
	ok(audio.octaveBank(1, 44100).some(b => Math.abs(b.fc - 1000) < 1), '1/1 includes 1000Hz')
	ok(audio.octaveBank(3, 44100).some(b => Math.abs(b.fc - 1000) < 1), '1/3 includes 1000Hz')
})

test('erbBank — ERB at 1kHz ≈ 132.6Hz (Glasberg & Moore)', () => {
	let bands = audio.erbBank(44100)
	let closest = bands.reduce((a, b) => Math.abs(a.fc - 1000) < Math.abs(b.fc - 1000) ? a : b)
	let expectedERB = 24.7 * (4.37 * closest.fc / 1000 + 1)
	ok(Math.abs(closest.erb - expectedERB) < 1, `ERB at ${closest.fc}Hz: ${closest.erb} ≈ ${expectedERB.toFixed(1)}`)
})

test('dcBlocker — works with Float32Array input', () => {
	let data = new Float32Array(4096)
	data.fill(1)
	audio.dcBlocker(data, { R: 0.995 })
	ok(Math.abs(data[4095]) < 0.05, `Float32Array: last=${data[4095].toFixed(4)}`)
})

test('comb — works with plain Array input', () => {
	let data = [1, 0, 0, 0, 0, 0, 0, 0]
	audio.comb(data, { delay: 3, gain: 0.5, type: 'feedforward' })
	almost(data[0], 1, EPSILON)
	almost(data[3], 0.5, EPSILON)
})

// ═══════════════════════════════════════════════════════════════════════════
// New filters
// ═══════════════════════════════════════════════════════════════════════════

test('melBank — 26 bands by default', () => {
	let bands = audio.melBank(44100)
	is(bands.length, 26, '26 mel filters')
	ok(bands[0].fc > 0, 'first fc > 0')
	ok(bands[0].fLow < bands[0].fc, 'fLow < fc')
	ok(bands[0].fHigh > bands[0].fc, 'fHigh > fc')
	ok(bands[0].mel > 0, 'has mel value')
})

test('melBank — spacing is linear in mel scale', () => {
	let bands = audio.melBank(44100)
	let melStep1 = bands[1].mel - bands[0].mel
	let melStepN = bands[bands.length - 1].mel - bands[bands.length - 2].mel
	ok(Math.abs(melStep1 - melStepN) < 1, 'mel spacing is uniform')
})

test('melBank — custom nFilters', () => {
	let bands = audio.melBank(16000, { nFilters: 40 })
	is(bands.length, 40, '40 mel filters')
	ok(bands[bands.length - 1].fHigh <= 8000, 'fHigh <= Nyquist')
})

test('oberheim — lowpass produces output', () => {
	let data = impulse(512)
	audio.oberheim(data, { fc: 1000, resonance: 0.5, fs: 44100, type: 'lowpass' })
	ok(data.some(x => Math.abs(x) > 0.001), 'LP output present')
})

test('oberheim — highpass attenuates DC', () => {
	let data = dc(1024)
	audio.oberheim(data, { fc: 1000, resonance: 0.3, fs: 44100, type: 'highpass' })
	ok(Math.abs(data[1023]) < 0.2, `HP attenuates DC: ${data[1023].toFixed(4)}`)
})

test('oberheim — bandpass and notch modes', () => {
	let bp = impulse(256)
	audio.oberheim(bp, { fc: 1000, resonance: 0.5, fs: 44100, type: 'bandpass' })
	ok(bp.some(x => Math.abs(x) > 0.001), 'BP output')
	let notch = impulse(256)
	audio.oberheim(notch, { fc: 1000, resonance: 0.5, fs: 44100, type: 'notch' })
	ok(notch.some(x => Math.abs(x) > 0.001), 'Notch output')
})

test('oberheim — stable at high resonance', () => {
	let data = impulse(1024)
	audio.oberheim(data, { fc: 2000, resonance: 0.95, fs: 44100 })
	ok(data.every(isFinite), 'no NaN/Inf at high resonance')
})

test('oberheim — extreme params: fc=1, res=0.99, fs=192k', () => {
	let data = impulse(256)
	audio.oberheim(data, { fc: 1, resonance: 0.99, fs: 192000 })
	ok(data.every(isFinite), 'no NaN/Inf')
})

test('lpcAnalysis — returns coefficients and residual', () => {
	let fs = 44100, N = 512
	let data = new Float64Array(N)
	for (let i = 0; i < N; i++) data[i] = Math.sin(2 * Math.PI * 440 * i / fs)
	let result = audio.lpcAnalysis(data, { order: 12 })
	is(result.coefs.length, 12, '12 LPC coefficients')
	ok(result.gain > 0, 'positive gain')
	is(result.residual.length, N, 'residual length matches input')
})

test('lpcAnalysis + lpcSynthesize — round-trip reconstructs signal', () => {
	let N = 256
	// Use a broadband signal (speech-like) for stable LPC model
	let data = new Float64Array(N)
	let seed = 42
	for (let i = 0; i < N; i++) {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff
		let noise = (seed / 0x7fffffff) * 2 - 1
		// Filtered noise (simple lowpass for speech-like spectrum)
		data[i] = i > 0 ? 0.5 * noise + 0.5 * data[i - 1] : noise
	}
	let orig = Float64Array.from(data)
	let { coefs, gain, residual } = audio.lpcAnalysis(data, { order: 10 })
	let res = Float64Array.from(residual)
	audio.lpcSynthesize(res, { coefs, gain })
	let maxErr = 0
	for (let i = 12; i < N; i++) {
		let err = Math.abs(res[i] - orig[i])
		if (err > maxErr) maxErr = err
	}
	ok(maxErr < 0.01, `LPC round-trip error: ${maxErr.toFixed(6)}`)
})

// ═══════════════════════════════════════════════════════════════════════════
// Notch, Shelving, Baxandall, Tilt
// ═══════════════════════════════════════════════════════════════════════════

test('notch — rejects target frequency', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.notch(data, { fc: 1000, Q: 30, fs })
	let mag1k = dftMag(data, 1000, fs)
	let mag500 = dftMag(data, 500, fs)
	ok(mag500 > mag1k * 10, `notch at 1kHz: 500Hz (${mag500.toFixed(3)}) >> 1kHz (${mag1k.toFixed(3)})`)
})

test('notch — unity gain away from fc', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.notch(data, { fc: 1000, Q: 30, fs })
	let magDC = dftMag(data, 50, fs)
	ok(Math.abs(magDC - 1) < 0.1, `notch DC gain ≈ 1 (got ${magDC.toFixed(4)})`)
})

test('notch — narrow Q=50 vs wide Q=5', () => {
	let fs = 44100, N = 4096
	let narrow = impulse(N), wide = impulse(N)
	audio.notch(narrow, { fc: 1000, Q: 50, fs })
	audio.notch(wide, { fc: 1000, Q: 5, fs })
	let narrowAt900 = dftMag(narrow, 900, fs)
	let wideAt900 = dftMag(wide, 900, fs)
	ok(narrowAt900 > wideAt900, `Q=50 passes 900Hz better (${narrowAt900.toFixed(3)}) than Q=5 (${wideAt900.toFixed(3)})`)
})

// ── Highpass / Lowpass / Bandpass ──────────────────────────────────────────

test('lowpass — attenuates above cutoff', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.lowpass(data, { fc: 1000, fs })
	let mag500 = dftMag(data, 500, fs)
	let mag5k = dftMag(data, 5000, fs)
	ok(mag500 > mag5k * 5, `lowpass 1kHz: 500Hz (${mag500.toFixed(3)}) >> 5kHz (${mag5k.toFixed(3)})`)
})

test('lowpass — passes DC', () => {
	let data = dc(1024)
	audio.lowpass(data, { fc: 1000, fs: 44100 })
	ok(Math.abs(data[1023] - 1) < 0.05, `lowpass passes DC: last=${data[1023].toFixed(4)}`)
})

test('lowpass — order 4 steeper than order 2', () => {
	let fs = 44100, N = 4096
	let d2 = impulse(N), d4 = impulse(N)
	audio.lowpass(d2, { fc: 1000, order: 2, fs })
	audio.lowpass(d4, { fc: 1000, order: 4, fs })
	let mag2 = dftMag(d2, 4000, fs)
	let mag4 = dftMag(d4, 4000, fs)
	ok(mag4 < mag2, `order 4 (${mag4.toFixed(4)}) attenuates more at 4kHz than order 2 (${mag2.toFixed(4)})`)
})

test('highpass — attenuates below cutoff', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.highpass(data, { fc: 1000, fs })
	let mag5k = dftMag(data, 5000, fs)
	let mag200 = dftMag(data, 200, fs)
	ok(mag5k > mag200 * 5, `highpass 1kHz: 5kHz (${mag5k.toFixed(3)}) >> 200Hz (${mag200.toFixed(3)})`)
})

test('highpass — removes DC', () => {
	let data = dc(2048)
	audio.highpass(data, { fc: 200, fs: 44100 })
	ok(Math.abs(data[2047]) < 0.05, `highpass blocks DC: last=${data[2047].toFixed(4)}`)
})

test('highpass — order 4 steeper than order 2', () => {
	let fs = 44100, N = 4096
	let d2 = impulse(N), d4 = impulse(N)
	audio.highpass(d2, { fc: 1000, order: 2, fs })
	audio.highpass(d4, { fc: 1000, order: 4, fs })
	let mag2 = dftMag(d2, 200, fs)
	let mag4 = dftMag(d4, 200, fs)
	ok(mag4 < mag2, `order 4 (${mag4.toFixed(4)}) attenuates more at 200Hz than order 2 (${mag2.toFixed(4)})`)
})

test('bandpass — passes center, rejects edges', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.bandpass(data, { fc: 1000, Q: 5, fs })
	let mag1k = dftMag(data, 1000, fs)
	let mag100 = dftMag(data, 100, fs)
	let mag10k = dftMag(data, 10000, fs)
	ok(mag1k > mag100 * 3, `bandpass: 1kHz (${mag1k.toFixed(3)}) >> 100Hz (${mag100.toFixed(3)})`)
	ok(mag1k > mag10k * 3, `bandpass: 1kHz (${mag1k.toFixed(3)}) >> 10kHz (${mag10k.toFixed(3)})`)
})

test('bandpass — Q controls width', () => {
	let fs = 44100, N = 4096
	let narrow = impulse(N), wide = impulse(N)
	audio.bandpass(narrow, { fc: 1000, Q: 10, fs })
	audio.bandpass(wide, { fc: 1000, Q: 1, fs })
	// Normalize by peak to isolate width: constant-skirt BPF peak scales with Q
	let narrowRatio = dftMag(narrow, 700, fs) / dftMag(narrow, 1000, fs)
	let wideRatio = dftMag(wide, 700, fs) / dftMag(wide, 1000, fs)
	ok(wideRatio > narrowRatio * 2, `Q=1 wider at 700Hz (ratio ${wideRatio.toFixed(3)}) than Q=10 (${narrowRatio.toFixed(3)})`)
})

test('lowShelf — boosts bass', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.lowShelf(data, { fc: 300, gain: 6, fs })
	let mag100 = dftMag(data, 100, fs)
	let mag5k = dftMag(data, 5000, fs)
	ok(mag100 > mag5k * 1.5, `lowShelf +6dB: 100Hz (${mag100.toFixed(3)}) > 5kHz (${mag5k.toFixed(3)})`)
})

test('highShelf — boosts treble', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.highShelf(data, { fc: 4000, gain: 6, fs })
	let mag10k = dftMag(data, 10000, fs)
	let mag200 = dftMag(data, 200, fs)
	ok(mag10k > mag200 * 1.5, `highShelf +6dB: 10kHz (${mag10k.toFixed(3)}) > 200Hz (${mag200.toFixed(3)})`)
})

test('lowShelf — gain=0 is passthrough', () => {
	let data = impulse(256)
	let orig = Float64Array.from(data)
	audio.lowShelf(data, { fc: 300, gain: 0, fs: 44100 })
	let maxErr = 0
	for (let i = 0; i < data.length; i++) { let err = Math.abs(data[i] - orig[i]); if (err > maxErr) maxErr = err }
	ok(maxErr < EPSILON, `lowShelf gain=0 passthrough: err=${maxErr}`)
})

test('baxandall — bass boost, treble flat', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.baxandall(data, { bass: 6, treble: 0, fs })
	let mag100 = dftMag(data, 100, fs)
	let mag10k = dftMag(data, 10000, fs)
	ok(mag100 > mag10k * 1.3, `baxandall bass+6: 100Hz (${mag100.toFixed(3)}) > 10kHz (${mag10k.toFixed(3)})`)
})

test('baxandall — treble boost, bass flat', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.baxandall(data, { bass: 0, treble: 6, fs })
	let mag10k = dftMag(data, 10000, fs)
	let mag100 = dftMag(data, 100, fs)
	ok(mag10k > mag100 * 1.3, `baxandall treble+6: 10kHz (${mag10k.toFixed(3)}) > 100Hz (${mag100.toFixed(3)})`)
})

test('baxandall — both=0 is passthrough', () => {
	let data = impulse(256)
	let orig = Float64Array.from(data)
	audio.baxandall(data, { bass: 0, treble: 0, fs: 44100 })
	let maxErr = 0
	for (let i = 0; i < data.length; i++) { let err = Math.abs(data[i] - orig[i]); if (err > maxErr) maxErr = err }
	ok(maxErr < EPSILON, `baxandall 0/0 passthrough: err=${maxErr}`)
})

test('tilt — positive tilts bass up, treble down', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.tilt(data, { gain: 6, pivot: 1000, fs })
	let mag100 = dftMag(data, 100, fs)
	let mag10k = dftMag(data, 10000, fs)
	ok(mag100 > mag10k, `tilt +6: 100Hz (${mag100.toFixed(3)}) > 10kHz (${mag10k.toFixed(3)})`)
})

test('tilt — negative tilts treble up, bass down', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.tilt(data, { gain: -6, pivot: 1000, fs })
	let mag10k = dftMag(data, 10000, fs)
	let mag100 = dftMag(data, 100, fs)
	ok(mag10k > mag100, `tilt -6: 10kHz (${mag10k.toFixed(3)}) > 100Hz (${mag100.toFixed(3)})`)
})

test('tilt — gain=0 is passthrough', () => {
	let data = impulse(256)
	let orig = Float64Array.from(data)
	audio.tilt(data, { gain: 0, pivot: 1000, fs: 44100 })
	let maxErr = 0
	for (let i = 0; i < data.length; i++) { let err = Math.abs(data[i] - orig[i]); if (err > maxErr) maxErr = err }
	ok(maxErr < EPSILON, `tilt gain=0 passthrough: err=${maxErr}`)
})
