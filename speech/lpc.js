/**
 * Linear Predictive Coding analysis/synthesis.
 * Autocorrelation method with Levinson-Durbin recursion.
 *
 * @module  digital-filter/lpc
 */

/**
 * LPC analysis via autocorrelation + Levinson-Durbin.
 * @param {Float64Array} data - Input signal
 * @param {object} params - { order (12), fs (44100) }
 * @returns {{ coefs: Float64Array, gain: number, residual: Float64Array }}
 */
export function lpcAnalysis(data, params) {
	let order = params.order || 12
	let N = data.length

	// Autocorrelation r[0..order]
	let r = new Float64Array(order + 1)
	for (let i = 0; i <= order; i++) {
		for (let n = i; n < N; n++) r[i] += data[n] * data[n - i]
	}

	// Levinson-Durbin
	let a = new Float64Array(order + 1)
	let prev = new Float64Array(order + 1)
	a[0] = 1
	let E = r[0]

	for (let i = 1; i <= order; i++) {
		let sum = 0
		for (let j = 1; j < i; j++) sum += a[j] * r[i - j]
		let k = -(r[i] + sum) / E

		// Copy current coefficients
		prev.set(a)

		for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j]
		a[i] = k

		E *= (1 - k * k)
	}

	let gain = Math.sqrt(E)
	let coefs = a.subarray(1) // a[1..order]

	// Inverse filter: residual e[n] = x[n] - sum(a[k]*x[n-k])
	let residual = new Float64Array(N)
	for (let n = 0; n < N; n++) {
		let sum = 0
		for (let k = 1; k <= order; k++) if (n - k >= 0) sum += coefs[k - 1] * data[n - k]
		residual[n] = data[n] - sum
	}

	return { coefs: new Float64Array(coefs), gain, residual }
}

/**
 * All-pole synthesis filter.
 * @param {Float64Array} residual - Residual/excitation signal (modified in-place)
 * @param {object} params - { coefs, gain, _s (internal state) }
 * @returns {Float64Array} Synthesized signal
 */
export function lpcSynthesize(residual, params) {
	let coefs = params.coefs
	let gain = params.gain
	let order = coefs.length
	let N = residual.length

	if (!params._s) params._s = new Float64Array(order)
	let s = params._s

	for (let n = 0; n < N; n++) {
		let y = residual[n]
		for (let k = 0; k < order; k++) y += coefs[k] * s[k]
		residual[n] = y

		// Shift state
		for (let k = order - 1; k > 0; k--) s[k] = s[k - 1]
		s[0] = y
	}

	return residual
}
