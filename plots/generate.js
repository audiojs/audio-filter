/**
 * Generate SVG plots for filter documentation.
 * Run: node plots/generate.js
 *
 * Each filter gets a 4-panel plot:
 *   Top-left:     Magnitude response (dB vs Hz, log)
 *   Top-right:    Phase response (degrees vs Hz, log)
 *   Bottom-left:  Group delay (samples vs Hz, log)
 *   Bottom-right: Impulse response (amplitude vs samples)
 */
import { freqz, mag2db, groupDelay, impulseResponse } from 'digital-filter'
import * as af from '../index.js'
import { writeFileSync, mkdirSync } from 'node:fs'

let FS = 44100, NF = 2048
mkdirSync('plots', { recursive: true })

let GRID = '#e5e7eb', AXIS = '#d1d5db', TXT = '#6b7280'
let C = ['#4a90d9', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e']
let LM = 34, TM = 16, RM = 20, GAP = 36, PW = 365, PH = 155
let W = LM + PW + GAP + PW + RM, H = TM + PH + GAP + PH + 16

let P1 = { x: LM, y: TM, w: PW, h: PH }
let P2 = { x: LM + PW + GAP, y: TM, w: PW, h: PH }
let P3 = { x: LM, y: TM + PH + GAP, w: PW, h: PH }
let P4 = { x: LM + PW + GAP, y: TM + PH + GAP, w: PW, h: PH }

// ── SVG primitives ──

function svgOpen () { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="font-family:system-ui,-apple-system,sans-serif">\n` }

function fcLine (p, fc, fMin = 10, fMax = 20000) {
	if (!fc || fc < fMin || fc > fMax) return ''
	let x = (p.x + Math.log10(fc / fMin) / Math.log10(fMax / fMin) * p.w).toFixed(1)
	return `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${AXIS}" stroke-width="1" stroke-dasharray="4 3"/>\n`
}

function parseFc (title) {
	let m = title?.match(/fc=(\d+(?:\.\d+)?)\s*(k?)\s*Hz/i)
	if (!m) return null
	return +m[1] * (m[2].toLowerCase() === 'k' ? 1000 : 1)
}

function panel (p, xLabel, yLabel, yMin, yMax, zeroAt) {
	let axisY = (zeroAt != null && yMin != null) ?
		(p.y + p.h - (zeroAt - yMin) / (yMax - yMin) * p.h) : (p.y + p.h)
	return `  <line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y+p.h}" stroke="${AXIS}"/>\n` +
		`  <line x1="${p.x}" y1="${axisY.toFixed(1)}" x2="${p.x+p.w}" y2="${axisY.toFixed(1)}" stroke="${AXIS}"/>\n` +
		`  <text x="${p.x+p.w/2}" y="${p.y+p.h+26}" text-anchor="middle" font-size="9" fill="${TXT}">${xLabel}</text>\n` +
		`  <text x="${p.x-22}" y="${p.y+p.h/2}" text-anchor="middle" font-size="9" fill="${TXT}" transform="rotate(-90 ${p.x-22} ${p.y+p.h/2})">${yLabel}</text>\n`
}

function hTicks (p, ticks, yMin, yMax) {
	let s = ''
	for (let v of ticks) {
		let y = (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
		if (v !== 0) s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${TXT}">${v}</text>\n`
	}
	return s
}

function logXTicks (p, ticks, fMin, fMax) {
	let s = '', lr = Math.log10(fMax / fMin)
	let decade = Math.pow(10, Math.floor(Math.log10(fMin)))
	while (decade < fMax) {
		for (let m = 2; m <= 9; m++) {
			let f = decade * m
			if (f >= fMin && f <= fMax) {
				let x = (p.x + Math.log10(f / fMin) / lr * p.w).toFixed(1)
				s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${GRID}" stroke-width="0.5"/>\n`
			}
		}
		decade *= 10
	}
	for (let f of ticks) {
		let x = (p.x + Math.log10(f / fMin) / lr * p.w).toFixed(1)
		s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${x}" y="${p.y+p.h+12}" text-anchor="middle" font-size="8" fill="${TXT}">${f >= 1000 ? (f/1000) + 'k' : f}</text>\n`
	}
	return s
}

function linXTicks (p, ticks, xMin, xMax) {
	let s = ''
	for (let v of ticks) {
		let x = (p.x + (v - xMin) / (xMax - xMin) * p.w).toFixed(1)
		s += `  <line x1="${x}" y1="${p.y}" x2="${x}" y2="${p.y+p.h}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${x}" y="${p.y+p.h+12}" text-anchor="middle" font-size="8" fill="${TXT}">${v}</text>\n`
	}
	return s
}

let _gradId = 0

function _fill (p, pts, baselineY, clr) {
	if (pts.length < 2) return ''
	let by = Math.max(p.y, Math.min(p.y + p.h, baselineY))
	let hasAbove = false, hasBelow = false
	for (let pt of pts) {
		let y = +pt.split(',')[1]
		if (y < by - 0.5) hasAbove = true
		if (y > by + 0.5) hasBelow = true
	}
	let s = ''
	let x0 = pts[0].split(',')[0], xN = pts[pts.length - 1].split(',')[0]
	let bys = by.toFixed(1)
	let path = `M${pts[0]} ${pts.join(' ')} L${xN},${bys} L${x0},${bys} Z`
	if (hasAbove && hasBelow) {
		let idA = 'g' + (_gradId++), idB = 'g' + (_gradId++)
		let clipA = 'c' + (_gradId++), clipB = 'c' + (_gradId++)
		s += `  <defs><linearGradient id="${idA}" x1="0" y1="${p.y}" x2="0" y2="${bys}" gradientUnits="userSpaceOnUse">\n`
		s += `    <stop offset="0%" stop-color="${clr}" stop-opacity="0.15"/>\n`
		s += `    <stop offset="100%" stop-color="${clr}" stop-opacity="0.02"/>\n`
		s += `  </linearGradient></defs>\n`
		s += `  <defs><linearGradient id="${idB}" x1="0" y1="${p.y + p.h}" x2="0" y2="${bys}" gradientUnits="userSpaceOnUse">\n`
		s += `    <stop offset="0%" stop-color="${clr}" stop-opacity="0.15"/>\n`
		s += `    <stop offset="100%" stop-color="${clr}" stop-opacity="0.02"/>\n`
		s += `  </linearGradient></defs>\n`
		s += `  <defs><clipPath id="${clipA}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${(by - p.y).toFixed(1)}"/></clipPath></defs>\n`
		s += `  <defs><clipPath id="${clipB}"><rect x="${p.x}" y="${bys}" width="${p.w}" height="${(p.y + p.h - by).toFixed(1)}"/></clipPath></defs>\n`
		s += `  <path d="${path}" fill="url(#${idA})" clip-path="url(#${clipA})"/>\n`
		s += `  <path d="${path}" fill="url(#${idB})" clip-path="url(#${clipB})"/>\n`
	} else {
		let id = 'g' + (_gradId++)
		let curveAbove = +pts[0].split(',')[1] < by
		let fromY = curveAbove ? p.y : p.y + p.h
		s += `  <defs><linearGradient id="${id}" x1="0" y1="${fromY}" x2="0" y2="${bys}" gradientUnits="userSpaceOnUse">\n`
		s += `    <stop offset="0%" stop-color="${clr}" stop-opacity="0.15"/>\n`
		s += `    <stop offset="100%" stop-color="${clr}" stop-opacity="0.02"/>\n`
		s += `  </linearGradient></defs>\n`
		s += `  <path d="${path}" fill="url(#${id})"/>\n`
	}
	return s
}

function logPoly (p, freqs, vals, fMin, fMax, yMin, yMax, clr, w, fill, fillBase) {
	let fillPts = [], linePts = [], lr = Math.log10(fMax / fMin), lm = Math.log10(fMin)
	let lastPx = -Infinity
	for (let i = 0; i < freqs.length; i++) {
		if (freqs[i] <= 0 || freqs[i] < fMin || freqs[i] > fMax) continue
		let x = p.x + (Math.log10(freqs[i]) - lm) / lr * p.w
		if (x - lastPx < 0.8 && i < freqs.length - 1) continue
		lastPx = x
		let vc = Math.max(yMin, Math.min(yMax, vals[i]))
		let yc = p.y + p.h - (vc - yMin) / (yMax - yMin) * p.h
		fillPts.push(`${x.toFixed(1)},${yc.toFixed(1)}`)
		let y = p.y + p.h - (vals[i] - yMin) / (yMax - yMin) * p.h
		linePts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
	}
	let s = ''
	if (fill !== false && fillPts.length > 1) {
		if (fillBase === 'down') {
			let id = 'g' + (_gradId++)
			s += `  <defs><linearGradient id="${id}" x1="0" y1="${p.y}" x2="0" y2="${p.y+p.h}" gradientUnits="userSpaceOnUse">\n`
			s += `    <stop offset="0%" stop-color="${clr}" stop-opacity="0.15"/>\n`
			s += `    <stop offset="100%" stop-color="${clr}" stop-opacity="0.02"/>\n`
			s += `  </linearGradient></defs>\n`
			let by = (p.y + p.h).toFixed(1)
			let x0 = fillPts[0].split(',')[0], xN = fillPts[fillPts.length-1].split(',')[0]
			s += `  <path d="M${fillPts[0]} ${fillPts.join(' ')} L${xN},${by} L${x0},${by} Z" fill="url(#${id})"/>\n`
		} else {
			let baseVal = Math.max(yMin, Math.min(yMax, 0))
			let baseY = p.y + p.h - (baseVal - yMin) / (yMax - yMin) * p.h
			s += _fill(p, fillPts, baseY, clr)
		}
	}
	let clipId = 'pc' + (_gradId++)
	s += `  <defs><clipPath id="${clipId}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath></defs>\n`
	s += `  <polyline points="${linePts.join(' ')}" fill="none" stroke="${clr}" stroke-width="${w||1.3}" stroke-linejoin="round" clip-path="url(#${clipId})"/>\n`
	return s
}

function linPoly (p, data, xMin, xMax, yMin, yMax, clr, fill) {
	let fillPts = [], linePts = [], lastPx = -Infinity
	for (let i = 0; i < data.length; i++) {
		let x = p.x + (i - xMin) / (xMax - xMin) * p.w
		if (x - lastPx < 0.8 && i < data.length - 1 && i > 0) continue
		lastPx = x
		let vc = Math.max(yMin, Math.min(yMax, data[i]))
		let yc = p.y + p.h - (vc - yMin) / (yMax - yMin) * p.h
		fillPts.push(`${x.toFixed(1)},${yc.toFixed(1)}`)
		let y = p.y + p.h - (data[i] - yMin) / (yMax - yMin) * p.h
		linePts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
	}
	let s = ''
	if (fill !== false && fillPts.length > 1) {
		let baseVal = Math.max(yMin, Math.min(yMax, 0))
		let baseY = p.y + p.h - (baseVal - yMin) / (yMax - yMin) * p.h
		s += _fill(p, fillPts, baseY, clr)
	}
	let clipId = 'pc' + (_gradId++)
	s += `  <defs><clipPath id="${clipId}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath></defs>\n`
	s += `  <polyline points="${linePts.join(' ')}" fill="none" stroke="${clr}" stroke-width="1.3" stroke-linejoin="round" clip-path="url(#${clipId})"/>\n`
	return s
}

function legend (items, p) {
	let s = ''
	let lh = 12, x = p.x + 20
	let y0 = p.y + p.h - 20 - (items.length - 1) * lh
	s += `  <rect x="${x-6}" y="${y0-8}" width="92" height="${items.length*lh+10}" fill="white" fill-opacity="0.85" rx="3"/>\n`
	for (let i = 0; i < items.length; i++) {
		let y = y0 + i * lh
		s += `  <line x1="${x}" y1="${y+3}" x2="${x+12}" y2="${y+3}" stroke="${items[i][1]}" stroke-width="2"/>\n`
		s += `  <text x="${x+16}" y="${y+6}" font-size="8" fill="${TXT}">${items[i][0]}</text>\n`
	}
	return s
}

let fTicks = [100, 1000, 10000]

function dbGrid (p) {
	let yMin = -80, yMax = 20, s = ''
	let toY = v => (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
	for (let v of [10, -10]) {
		s += `  <line x1="${p.x}" y1="${toY(v)}" x2="${p.x+p.w}" y2="${toY(v)}" stroke="${GRID}" stroke-width="0.5"/>\n`
	}
	for (let v of [20, 0, -20, -40, -60, -80]) {
		let y = toY(v)
		if (v !== 0) s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${TXT}">${v > 0 ? '+' + v : v}</text>\n`
	}
	return s
}

function phaseGrid (p) {
	let yMin = -200, yMax = 200, s = ''
	let toY = v => (p.y + p.h - (v - yMin) / (yMax - yMin) * p.h).toFixed(1)
	for (let v of [90, -90]) {
		s += `  <line x1="${p.x}" y1="${toY(v)}" x2="${p.x+p.w}" y2="${toY(v)}" stroke="${GRID}" stroke-width="0.5"/>\n`
	}
	for (let v of [180, 0, -180]) {
		let y = toY(v)
		if (v !== 0) s += `  <line x1="${p.x}" y1="${y}" x2="${p.x+p.w}" y2="${y}" stroke="${GRID}" stroke-width="0.5"/>\n`
		s += `  <text x="${p.x-4}" y="${(+y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="${TXT}">${v}</text>\n`
	}
	return s
}

function autoTicks (lo, hi, n) {
	let range = hi - lo
	if (range === 0) return [lo]
	let step = range / n
	let mag = Math.pow(10, Math.floor(Math.log10(step)))
	step = Math.ceil(step / mag) * mag
	let ticks = [], start = Math.ceil(lo / step) * step
	for (let v = start; v <= hi + step * 0.01; v += step) ticks.push(Math.round(v * 1000) / 1000)
	return ticks
}

// ── 4-panel plot for SOS-based filters ──

function plotFilter (name, sos, title) {
	let r = freqz(sos, NF, FS)
	let db = mag2db(r.magnitude)
	let phase = Array.from(r.phase).map(v => v * 180 / Math.PI)
	let gd = groupDelay(sos, NF, FS)
	let ir = impulseResponse(sos, 128)

	let irMax = 0
	for (let i = 0; i < ir.length; i++) if (Math.abs(ir[i]) > irMax) irMax = Math.abs(ir[i])
	if (irMax < 1e-10) irMax = 1

	let gdMin = Infinity, gdMax = -Infinity
	for (let i = 1; i < gd.delay.length; i++) {
		if (isFinite(gd.delay[i])) { if (gd.delay[i] < gdMin) gdMin = gd.delay[i]; if (gd.delay[i] > gdMax) gdMax = gd.delay[i] }
	}
	if (!isFinite(gdMin)) { gdMin = -1; gdMax = 1 }
	let gdSpan = Math.max(Math.abs(gdMin), Math.abs(gdMax), 1) * 1.3

	let fc = parseFc(title)
	let s = svgOpen()
	s += `  <text x="${P2.x+P2.w}" y="${P2.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${TXT}">${title || name}</text>\n`
	s += panel(P1, 'Hz', 'dB', -80, 20, 0) + logXTicks(P1, fTicks, 10, 20000) + dbGrid(P1) + fcLine(P1, fc)
	s += logPoly(P1, r.frequencies, Array.from(db), 10, 20000, -80, 20, C[0], 1.5, true, 'down')
	s += panel(P2, 'Hz', 'Phase (deg)', -200, 200, 0) + logXTicks(P2, fTicks, 10, 20000) + phaseGrid(P2) + fcLine(P2, fc)
	s += logPoly(P2, r.frequencies, phase, 10, 20000, -200, 200, C[1], 1.5, true, 'zero')
	s += panel(P3, 'Hz', 'Group delay', -gdSpan, gdSpan, 0) + logXTicks(P3, fTicks, 10, 20000) + hTicks(P3, autoTicks(-gdSpan, gdSpan, 4), -gdSpan, gdSpan) + fcLine(P3, fc)
	s += logPoly(P3, gd.frequencies, Array.from(gd.delay), 10, 20000, -gdSpan, gdSpan, C[2], 1.5, true, 'zero')
	s += panel(P4, 'Samples', 'Impulse response', -irMax, irMax, 0) + linXTicks(P4, [0, 32, 64, 96, 128], 0, 128) + hTicks(P4, autoTicks(-irMax, irMax, 3), -irMax, irMax)
	s += linPoly(P4, ir, 0, 128, -irMax, irMax, C[3])
	writeFileSync(`plots/${name}.svg`, s + '</svg>\n')
}

// ── 4-panel plot for in-place filters (via impulse response) ──

function plotFir (name, h, title) {
	let freqs = new Float64Array(NF)
	let mag = new Float64Array(NF)
	let phase = new Float64Array(NF)
	for (let k = 0; k < NF; k++) {
		freqs[k] = k * FS / (2 * NF)
		let re = 0, im = 0, w = Math.PI * k / NF
		for (let n = 0; n < h.length; n++) { re += h[n] * Math.cos(w * n); im -= h[n] * Math.sin(w * n) }
		mag[k] = 20 * Math.log10(Math.max(Math.sqrt(re * re + im * im), 1e-15))
		phase[k] = Math.atan2(im, re) * 180 / Math.PI
	}
	let gdVals = new Float64Array(NF)
	for (let k = 1; k < NF - 1; k++) {
		let dp = phase[k + 1] - phase[k - 1]
		if (dp > 180) dp -= 360; if (dp < -180) dp += 360
		gdVals[k] = -dp / (2 * Math.PI / NF * 180 / Math.PI)
	}
	gdVals[0] = gdVals[1]

	let hMax = 0
	for (let i = 0; i < h.length; i++) if (Math.abs(h[i]) > hMax) hMax = Math.abs(h[i])
	if (hMax < 1e-10) hMax = 1

	let gdMin = Infinity, gdMax = -Infinity
	for (let k = 1; k < NF * 0.8; k++) {
		if (isFinite(gdVals[k])) { if (gdVals[k] < gdMin) gdMin = gdVals[k]; if (gdVals[k] > gdMax) gdMax = gdVals[k] }
	}
	if (!isFinite(gdMin)) { gdMin = 0; gdMax = h.length }
	let gdSpan = Math.max(Math.abs(gdMin), Math.abs(gdMax), 1) * 1.3

	let fc = parseFc(title)
	let s = svgOpen()
	s += `  <text x="${P2.x+P2.w}" y="${P2.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${TXT}">${title || name}</text>\n`
	s += panel(P1, 'Hz', 'dB', -80, 20, 0) + logXTicks(P1, fTicks, 10, 20000) + dbGrid(P1) + fcLine(P1, fc)
	s += logPoly(P1, freqs, Array.from(mag), 10, 20000, -80, 20, C[0], 1.5, true, 'down')
	s += panel(P2, 'Hz', 'Phase (deg)', -200, 200, 0) + logXTicks(P2, fTicks, 10, 20000) + phaseGrid(P2) + fcLine(P2, fc)
	s += logPoly(P2, freqs, Array.from(phase), 10, 20000, -200, 200, C[1], 1.5, true, 'zero')
	s += panel(P3, 'Hz', 'Group delay', -gdSpan, gdSpan, 0) + logXTicks(P3, fTicks, 10, 20000) + hTicks(P3, autoTicks(-gdSpan, gdSpan, 4), -gdSpan, gdSpan) + fcLine(P3, fc)
	s += logPoly(P3, freqs, Array.from(gdVals), 10, 20000, -gdSpan, gdSpan, C[2], 1.5, true, 'zero')
	s += panel(P4, 'Samples', 'Impulse response', -hMax, hMax, 0) + linXTicks(P4, autoTicks(0, h.length, 3).map(Math.round), 0, h.length) + hTicks(P4, autoTicks(-hMax, hMax, 3), -hMax, hMax)
	s += linPoly(P4, h, 0, h.length, -hMax, hMax, C[3])
	writeFileSync(`plots/${name}.svg`, s + '</svg>\n')
}

// ── Overlay magnitude plot for filter banks ──
// bands: array of { coefs } (biquad) or { coefs: SOS[] }

let BP = { x: LM, y: TM, w: PW * 2 + GAP, h: PH * 2 + GAP }
let BW = LM + BP.w + RM, BH = TM + BP.h + 16

function plotBank (name, bands, title) {
	let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BW} ${BH}" style="font-family:system-ui,-apple-system,sans-serif">\n`
	s += `  <text x="${BP.x+BP.w}" y="${BP.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${TXT}">${title}</text>\n`
	s += panel(BP, 'Hz', 'dB', -80, 20, 0) + logXTicks(BP, fTicks, 20, 20000) + dbGrid(BP)
	for (let i = 0; i < bands.length; i++) {
		let sos = Array.isArray(bands[i].coefs) ? bands[i].coefs : [bands[i].coefs]
		let r = freqz(sos, NF, FS)
		let db = Array.from(mag2db(r.magnitude))
		s += logPoly(BP, r.frequencies, db, 20, 20000, -80, 20, C[i % C.length], 1, false)
	}
	writeFileSync(`plots/${name}.svg`, s + '</svg>\n')
}

// ═══════════════════════════════════════
// Generate all plots
// ═══════════════════════════════════════

// ── Weighting ──

// Comparison overlay
{
	let LP = { x: 55, y: 12, w: 330, h: 180 }
	let RP = { x: 445, y: 12, w: 330, h: 180 }
	let curves = [
		['A-weighting', af.aWeighting.coefs(FS), C[0]],
		['C-weighting', af.cWeighting.coefs(FS), C[1]],
		['K-weighting', af.kWeighting.coefs(48000), C[2]],
		['ITU-R 468',   af.itu468.coefs(48000), C[3]],
		['RIAA',        af.riaa.coefs(FS), C[4]],
	]
	let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240" style="font-family:system-ui,-apple-system,sans-serif">\n`
	s += panel(LP, 'Hz', 'dB', -80, 20, 0) + logXTicks(LP, fTicks, 10, 20000) + dbGrid(LP)
	s += panel(RP, 'Hz', 'Phase (deg)', -200, 200, 0) + logXTicks(RP, fTicks, 10, 20000) + phaseGrid(RP)
	for (let [n, sos, c] of curves) {
		let r = freqz(sos, NF, FS)
		s += logPoly(LP, r.frequencies, Array.from(mag2db(r.magnitude)), 10, 20000, -80, 20, c, 1.3, false)
		s += logPoly(RP, r.frequencies, Array.from(r.phase).map(v => v * 180 / Math.PI), 10, 20000, -200, 200, c, 1.3, false)
	}
	s += legend(curves.map(([n,,c]) => [n, c]), LP)
	writeFileSync('plots/weighting.svg', s + '</svg>\n')
}

plotFilter('a-weighting', af.aWeighting.coefs(FS), 'A-weighting (IEC 61672)')
plotFilter('c-weighting', af.cWeighting.coefs(FS), 'C-weighting (IEC 61672)')
plotFilter('k-weighting', af.kWeighting.coefs(48000), 'K-weighting (ITU-R BS.1770)')
plotFilter('itu468', af.itu468.coefs(48000), 'ITU-R 468 noise weighting')
plotFilter('riaa', af.riaa.coefs(FS), 'RIAA playback equalization')

// ── Auditory ──

{
	let data = new Float64Array(2048); data[0] = 1
	af.gammatone(data, {fc: 1000, fs: FS})
	plotFir('gammatone', data.slice(0, 512), 'Gammatone auditory filter, fc=1kHz')
}

// Gammatone sweep: multiple center frequencies
{
	let LP = { x: 55, y: 12, w: 700, h: 200 }
	let W2 = 55 + 700 + 20, H2 = 12 + 200 + 40
	let fcs = [250, 500, 1000, 2000, 4000, 8000]
	let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W2} ${H2}" style="font-family:system-ui,-apple-system,sans-serif">\n`
	s += `  <text x="${LP.x+LP.w}" y="${LP.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${TXT}">Gammatone filter bank</text>\n`
	s += panel(LP, 'Hz', 'dB', -80, 20, 0) + logXTicks(LP, fTicks, 20, 20000) + dbGrid(LP)
	for (let i = 0; i < fcs.length; i++) {
		let data = new Float64Array(4096); data[0] = 1
		af.gammatone(data, {fc: fcs[i], fs: FS})
		let h = data.slice(0, 2048)
		let freqs = new Float64Array(NF), mag = new Float64Array(NF)
		for (let k = 0; k < NF; k++) {
			freqs[k] = k * FS / (2 * NF)
			let re = 0, im = 0, w = Math.PI * k / NF
			for (let n = 0; n < h.length; n++) { re += h[n] * Math.cos(w * n); im -= h[n] * Math.sin(w * n) }
			mag[k] = 20 * Math.log10(Math.max(Math.sqrt(re * re + im * im), 1e-15))
		}
		s += logPoly(LP, freqs, Array.from(mag), 20, 20000, -80, 20, C[i], 1.3, false)
	}
	s += legend(fcs.map((f, i) => [`fc=${f >= 1000 ? f/1000 + 'k' : f}Hz`, C[i]]), LP)
	writeFileSync('plots/gammatone-bank.svg', s + '</svg>\n')
}

plotBank('octave-bank', af.octaveBank(3, FS), '1/3-octave filter bank')
plotBank('bark-bank', af.barkBank(FS), 'Bark critical band filter bank')

// ERB bank: descriptors only (fc, erb, bw) — plot gammatone at each center frequency
{
	let LP = { x: 55, y: 12, w: 700, h: 200 }
	let W2 = 55 + 700 + 20, H2 = 12 + 200 + 40
	let bands = af.erbBank(FS)
	// Subsample to 8 evenly spaced bands for legible overlay
	let step = Math.floor(bands.length / 8)
	let sampled = bands.filter((_, i) => i % step === 0).slice(0, 8)
	let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W2} ${H2}" style="font-family:system-ui,-apple-system,sans-serif">\n`
	s += `  <text x="${LP.x+LP.w}" y="${LP.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${TXT}">ERB auditory filter bank (gammatone)</text>\n`
	s += panel(LP, 'Hz', 'dB', -80, 20, 0) + logXTicks(LP, fTicks, 20, 20000) + dbGrid(LP)
	for (let i = 0; i < sampled.length; i++) {
		let data = new Float64Array(4096); data[0] = 1
		af.gammatone(data, {fc: sampled[i].fc, fs: FS})
		let h = data.slice(0, 2048)
		let freqs = new Float64Array(NF), mag = new Float64Array(NF)
		for (let k = 0; k < NF; k++) {
			freqs[k] = k * FS / (2 * NF)
			let re = 0, im = 0, w = Math.PI * k / NF
			for (let n = 0; n < h.length; n++) { re += h[n] * Math.cos(w * n); im -= h[n] * Math.sin(w * n) }
			mag[k] = 20 * Math.log10(Math.max(Math.sqrt(re * re + im * im), 1e-15))
		}
		s += logPoly(LP, freqs, Array.from(mag), 20, 20000, -80, 20, C[i % C.length], 1.3, false)
	}
	writeFileSync('plots/erb-bank.svg', s + '</svg>\n')
}

// ── Analog ──

// Moog resonance sweep
{
	let LP = { x: 55, y: 12, w: 330, h: 180 }
	let RP = { x: 445, y: 12, w: 330, h: 180 }
	let resonances = [0, 0.25, 0.5, 0.75, 1.0]
	let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240" style="font-family:system-ui,-apple-system,sans-serif">\n`
	s += `  <text x="${RP.x+RP.w}" y="${RP.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${TXT}">Moog ladder — resonance sweep, fc=1kHz</text>\n`
	s += panel(LP, 'Hz', 'dB', -80, 20, 0) + logXTicks(LP, fTicks, 10, 20000) + dbGrid(LP)
	s += panel(RP, 'Samples', 'Impulse response', -1, 1, 0) + linXTicks(RP, [0, 64, 128, 192, 256], 0, 256) + hTicks(RP, [-1, 0, 1], -1, 1)
	for (let i = 0; i < resonances.length; i++) {
		let data = new Float64Array(2048); data[0] = 1
		af.moogLadder(data, {fc: 1000, resonance: resonances[i], fs: FS})
		let h = data.slice(0, 2048)
		let freqs = new Float64Array(NF), mag = new Float64Array(NF)
		for (let k = 0; k < NF; k++) {
			freqs[k] = k * FS / (2 * NF)
			let re = 0, im = 0, w = Math.PI * k / NF
			for (let n = 0; n < h.length; n++) { re += h[n] * Math.cos(w * n); im -= h[n] * Math.sin(w * n) }
			mag[k] = 20 * Math.log10(Math.max(Math.sqrt(re * re + im * im), 1e-15))
		}
		s += logPoly(LP, freqs, Array.from(mag), 10, 20000, -80, 20, C[i], 1.3, false)
		let irMax = 0; for (let v of data.slice(0, 256)) if (Math.abs(v) > irMax) irMax = Math.abs(v)
		irMax = Math.max(irMax, 0.01)
		s += linPoly(RP, data.slice(0, 256), 0, 256, -1, 1, C[i], false)
	}
	s += legend(resonances.map((r, i) => [`res=${r}`, C[i]]), LP)
	writeFileSync('plots/moog-ladder.svg', s + '</svg>\n')
}

for (let [name, fn, params, title] of [
	['diode-ladder', af.diodeLadder, {fc: 1000, resonance: 0.5, fs: FS}, 'Diode ladder ZDF, fc=1kHz, res=0.5'],
	['korg35-lp',    af.korg35,      {fc: 1000, resonance: 0.3, fs: FS, type: 'lowpass'},  'Korg35 ZDF lowpass, fc=1kHz'],
	['korg35-hp',    af.korg35,      {fc: 1000, resonance: 0.3, fs: FS, type: 'highpass'}, 'Korg35 ZDF highpass, fc=1kHz'],
]) {
	let data = new Float64Array(2048); data[0] = 1
	fn(data, params)
	plotFir(name, data.slice(0, 256), title)
}

// ── Speech ──

{
	let data = new Float64Array(2048); data[0] = 1
	af.formant(data, {fs: FS})
	plotFir('formant', data.slice(0, 512), 'Formant filter (vowel /a/)')
}

// ── EQ ──

{
	let data = new Float64Array(2048); data[0] = 1
	af.graphicEq(data, {gains: {125: -6, 250: 0, 500: 3, 1000: 6, 2000: 3, 4000: 0, 8000: -3}, fs: FS})
	plotFir('graphic-eq', data.slice(0, 256), 'Graphic EQ (ISO octave bands)')
}

{
	let data = new Float64Array(2048); data[0] = 1
	af.parametricEq(data, {bands: [{fc: 400, Q: 1, gain: -6, type: 'peak'}, {fc: 2000, Q: 2, gain: 6, type: 'peak'}, {fc: 8000, Q: 0.7, gain: 3, type: 'highshelf'}], fs: FS})
	plotFir('parametric-eq', data.slice(0, 256), 'Parametric EQ (3 bands)')
}

// Crossover: overlay per-band magnitude
{
	let LP = { x: 55, y: 12, w: 700, h: 200 }
	let W2 = 55 + 700 + 20, H2 = 12 + 200 + 40
	let bands = af.crossover([500, 2000, 8000], 4, FS)
	let labels = ['low', 'mid-low', 'mid-high', 'high']
	let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W2} ${H2}" style="font-family:system-ui,-apple-system,sans-serif">\n`
	s += `  <text x="${LP.x+LP.w}" y="${LP.y-5}" text-anchor="end" font-size="11" font-weight="600" fill="${TXT}">4-way crossover at 500Hz / 2kHz / 8kHz</text>\n`
	s += panel(LP, 'Hz', 'dB', -80, 20, 0) + logXTicks(LP, fTicks, 20, 20000) + dbGrid(LP)
	for (let i = 0; i < bands.length; i++) {
		let r = freqz(bands[i], NF, FS)
		s += logPoly(LP, r.frequencies, Array.from(mag2db(r.magnitude)), 20, 20000, -80, 20, C[i], 1.3, false)
	}
	s += legend(labels.map((l, i) => [l, C[i]]), LP)
	writeFileSync('plots/crossover.svg', s + '</svg>\n')
}

{
	let left = new Float64Array(2048); left[0] = 1
	let right = new Float64Array(2048)
	af.crossfeed(left, right, {fc: 700, level: 0.3, fs: FS})
	plotFir('crossfeed', left.slice(0, 256), 'Crossfeed (headphone imaging), fc=700Hz')
}

// ── Effect ──

let dcbR = 0.995
plotFilter('dc-blocker', [{b0: 1, b1: -1, b2: 0, a1: -dcbR, a2: 0}], 'DC blocker (R=0.995)')

{
	let data = new Float64Array(2048); data[0] = 1
	af.comb(data, {delay: 100, gain: 0.7, type: 'feedback'})
	plotFir('comb', data.slice(0, 512), 'Feedback comb filter, delay=100, gain=0.7')
}

{
	let data = new Float64Array(2048); data[0] = 1
	af.allpass.first(data, {a: 0.5})
	plotFir('allpass-first', data.slice(0, 256), 'First-order allpass, a=0.5')
}

{
	let data = new Float64Array(2048); data[0] = 1
	af.allpass.second(data, {fc: 1000, Q: 1, fs: FS})
	plotFir('allpass-second', data.slice(0, 256), 'Second-order allpass, fc=1kHz, Q=1')
}

{
	let data = new Float64Array(2048); data[0] = 1
	af.emphasis(data, {alpha: 0.97})
	plotFir('pre-emphasis', data.slice(0, 256), 'Pre-emphasis, α=0.97')
}

{
	let rR = 1 - Math.PI * 50 / FS, rW = 2 * Math.PI * 1000 / FS
	plotFilter('resonator', [{b0: 1 - rR*rR, b1: 0, b2: 0, a1: -2*rR*Math.cos(rW), a2: rR*rR}], 'Resonator, fc=1kHz, bw=50Hz')
}

{
	let data = new Float64Array(2048); data[0] = 1
	af.spectralTilt(data, {slope: -3, fs: FS})
	plotFir('spectral-tilt', data.slice(0, 256), 'Spectral tilt, −3 dB/oct')
}

{
	let data = new Float64Array(2048); data[0] = 1
	af.variableBandwidth(data, {fc: 1000, Q: 0.707, fs: FS})
	plotFir('variable-bandwidth', data.slice(0, 256), 'Variable bandwidth lowpass, fc=1kHz')
}

{
	let data = new Float64Array(2048); data[0] = 1
	af.noiseShaping(data, {bits: 16})
	plotFir('noise-shaping', data.slice(0, 256), 'Noise shaping, 16-bit')
}

{
	let data = new Float64Array(256); data[0] = 1
	af.pinkNoise(data, {})
	plotFir('pink-noise', data, 'Pink noise filter, impulse response')
}

{
	let data = new Float64Array(2048); data[0] = 1
	af.envelope(data, {attack: 0.001, release: 0.05, fs: FS})
	plotFir('envelope', data.slice(0, 512), 'Envelope follower, atk=1ms, rel=50ms')
}

{
	let data = new Float64Array(2048); data[0] = 1
	af.slewLimiter(data, {rise: 1000, fall: 1000, fs: FS})
	plotFir('slew-limiter', data.slice(0, 256), 'Slew limiter, rate=1000/s')
}

console.log('SVGs written to plots/')
