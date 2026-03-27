/**
 * Pre-emphasis / de-emphasis filter
 * Used in speech processing, FM broadcasting.
 *
 * Pre-emphasis:  H(z) = 1 - α*z^-1  (boosts high frequencies)
 * De-emphasis:   H(z) = 1 / (1 - α*z^-1)  (cuts high frequencies)
 *
 * @module  digital-filter/pre-emphasis
 */

export function emphasis (data, params) {
	let alpha = params.alpha != null ? params.alpha : 0.97
	let x1 = params.x1 != null ? params.x1 : 0

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		data[i] = x - alpha * x1
		x1 = x
	}

	params.x1 = x1

	return data
}

export function deemphasis (data, params) {
	let alpha = params.alpha != null ? params.alpha : 0.97
	let y1 = params.y1 != null ? params.y1 : 0

	for (let i = 0, l = data.length; i < l; i++) {
		y1 = data[i] + alpha * y1
		data[i] = y1
	}

	params.y1 = y1

	return data
}
