#!/usr/bin/env node
/**
 * Generate SVG plots for audio-filter documentation.
 * Run: node plot/generate.js
 */
import { plotFilter, plotFir, plotCompare, theme } from 'digital-filter/plot'
import * as af from '../index.js'
import { writeFileSync } from 'node:fs'

let FS = theme.fs

function write (name, svg) { writeFileSync(`plot/${name}.svg`, svg) }

function impulse (fn, params, n = 2048, slice = 512) {
	let data = new Float64Array(n); data[0] = 1
	fn(data, params)
	return data.slice(0, slice)
}

// ── Weighting ──

write('weighting', plotCompare([
	['A-weighting', af.aWeighting.coefs(FS)],
	['C-weighting', af.cWeighting.coefs(FS)],
	['K-weighting', af.kWeighting.coefs(48000)],
	['ITU-R 468',   af.itu468.coefs(48000)],
	['RIAA',        af.riaa.coefs(FS)],
], 'Weighting filters comparison'))

write('a-weighting', plotFilter(af.aWeighting.coefs(FS),    'A-weighting (IEC 61672)'))
write('c-weighting', plotFilter(af.cWeighting.coefs(FS),    'C-weighting (IEC 61672)'))
write('k-weighting', plotFilter(af.kWeighting.coefs(48000), 'K-weighting (ITU-R BS.1770)'))
write('itu468',      plotFilter(af.itu468.coefs(48000),     'ITU-R 468 noise weighting'))
write('riaa',        plotFilter(af.riaa.coefs(FS),          'RIAA playback equalization'))

// ── Auditory ──

write('gammatone', plotFir(impulse(af.gammatone, {fc: 1000, fs: FS}), 'Gammatone fc=1kHz'))

{
	let fcs = [125, 250, 500, 1000, 2000, 4000, 8000]
	write('gammatone-bank', plotCompare(
		fcs.map(fc => {
			let d = new Float64Array(2048); d[0] = 1
			af.gammatone(d, {fc, fs: FS})
			return [`${fc < 1000 ? fc : fc/1000+'k'}Hz`, d.slice(0, 512)]
		}),
		'Gammatone bank (7 center frequencies)'
	))
}

{
	let bands = af.octaveBank(3, FS)
	let every3 = bands.filter((_, i) => i % 3 === 0).slice(0, 8)
	write('octave-bank', plotCompare(
		every3.map(b => [`${b.fc < 1000 ? b.fc.toFixed(0) : (b.fc/1000).toFixed(1)+'k'}`, b.coefs]),
		'1/3-octave filter bank'
	))
}

{
	let bands = af.barkBank(FS)
	let every2 = bands.filter((_, i) => i % 2 === 0).slice(0, 10)
	write('bark-bank', plotCompare(
		every2.map(b => [`${b.fc < 1000 ? b.fc.toFixed(0) : (b.fc/1000).toFixed(1)+'k'}`, b.coefs]),
		'Bark-scale critical-band filter bank'
	))
}

{
	let bands = af.erbBank(FS)
	let sampled = bands.filter((_, i) => i % 5 === 0).slice(0, 8)
	write('erb-bank', plotCompare(
		sampled.map(b => {
			let d = new Float64Array(2048); d[0] = 1
			af.gammatone(d, {fc: b.fc, fs: FS})
			return [`${b.fc < 1000 ? b.fc.toFixed(0) : (b.fc/1000).toFixed(1)+'k'}`, d.slice(0, 512)]
		}),
		'ERB-spaced filter bank'
	))
}

// ── Analog ──

{
	let resonances = [0, 0.25, 0.5, 0.75, 0.95]
	write('moog-ladder', plotCompare(
		resonances.map(r => [`res=${r}`, impulse(af.moogLadder, {fc: 1000, resonance: r, fs: FS})]),
		'Moog ladder fc=1kHz (resonance sweep)'
	))
}

write('diode-ladder', plotFir(impulse(af.diodeLadder, {fc: 1000, resonance: 0.5, fs: FS}), 'Diode ladder fc=1kHz, resonance=0.5'))

write('korg35', plotCompare([
	['LP', impulse(af.korg35, {fc: 1000, resonance: 0.3, type: 'lowpass',  fs: FS})],
	['HP', impulse(af.korg35, {fc: 1000, resonance: 0.3, type: 'highpass', fs: FS})],
], 'Korg35 fc=1kHz, resonance=0.3'))

// ── Speech ──

write('formant', plotFir(impulse(af.formant, {fs: FS}), 'Formant filter (vowel /a/)'))

// ── EQ ──

write('graphic-eq', plotFir(
	impulse(af.graphicEq, {gains: {250: -6, 1000: 6, 4000: -3, 8000: 6}, fs: FS}),
	'Graphic EQ'
))

write('parametric-eq', plotFir(
	impulse(af.parametricEq, {bands: [{fc: 300, Q: 1, gain: -6}, {fc: 3000, Q: 2, gain: 8}], fs: FS}),
	'Parametric EQ'
))

{
	let bands = af.crossover([500, 2000], 4, FS)
	write('crossover', plotCompare(
		bands.map((b, i) => [`Band ${i + 1}`, b]),
		'Linkwitz-Riley crossover at 500Hz / 2kHz'
	))
}

write('crossfeed', plotFir(
	impulse((d, p) => af.crossfeed(d, new Float64Array(d.length), p), {fc: 700, level: 0.3, fs: FS}),
	'Crossfeed (left channel), fc=700Hz, level=0.3'
))

// ── Effect ──

write('dc-blocker',        plotFir(impulse(af.dcBlocker,        {R: 0.995}),                              'DC blocker R=0.995'))
write('comb',              plotFir(impulse(af.comb,             {delay: 22, gain: 0.5}),                  'Comb feedforward, delay=22'))
write('allpass',           plotFir(impulse(af.allpass.second,   {fc: 1000, Q: 1, fs: FS}),                'Allpass 2nd order fc=1kHz'))
write('emphasis',          plotFir(impulse(af.emphasis,         {alpha: 0.97}),                           'Pre-emphasis α=0.97'))
write('deemphasis',        plotFir(impulse(af.deemphasis,       {alpha: 0.97}),                           'De-emphasis α=0.97'))
write('resonator',         plotFir(impulse(af.resonator,        {fc: 1000, bw: 50, fs: FS}),              'Resonator fc=1kHz, bw=50Hz'))
write('spectral-tilt',     plotFir(impulse(af.spectralTilt,     {slope: -3, fs: FS}),                     'Spectral tilt −3 dB/oct'))
write('variable-bandwidth',plotFir(impulse(af.variableBandwidth,{fc: 1000, Q: 1, fs: FS}),                'Variable bandwidth lowpass fc=1kHz'))
write('envelope',          plotFir(impulse(af.envelope,         {attack: 0.001, release: 0.05, fs: FS}, 4096, 2048), 'Envelope follower attack=1ms, release=50ms'))
write('slew-limiter',      plotFir(impulse(af.slewLimiter,      {rise: 500, fall: 200, fs: FS}),          'Slew limiter rise=500, fall=200'))
write('noise-shaping',     plotFir(impulse(af.noiseShaping,     {bits: 16}),                              'Noise shaping 16-bit'))

{
	let data = new Float64Array(2048)
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
	af.pinkNoise(data, {})
	write('pink-noise', plotFir(data.slice(0, 512), 'Pink noise (from white noise input)'))
}

console.log('SVGs generated in plot/')
