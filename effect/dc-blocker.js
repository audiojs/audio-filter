/**
 * DC blocking filter
 * H(z) = (1 - z^-1) / (1 - R*z^-1)
 *
 * @module  digital-filter/dc-blocker
 */

export default function dcBlocker (data, params) {
	let x1 = params.x1 != null ? params.x1 : 0
	let y1 = params.y1 != null ? params.y1 : 0
	let R = params.R
	if (R == null) R = .995

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let y = x - x1 + R * y1
		x1 = x
		y1 = y
		data[i] = y
	}

	params.x1 = x1
	params.y1 = y1

	return data
}
