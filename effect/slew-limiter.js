/**
 * Rate-of-change limiter
 * Nonlinear — clips the derivative. Prevents clicks, smooths control signals.
 *
 * @module  digital-filter/slew-limiter
 */

export default function slewLimiter (data, params) {
	let rise = params.rise || 1000
	let fall = params.fall || 1000
	let fs = params.fs || 44100

	let maxRise = rise / fs
	let maxFall = fall / fs

	let y = params.y != null ? params.y : data[0]

	for (let i = 0, l = data.length; i < l; i++) {
		let diff = data[i] - y
		if (diff > maxRise) diff = maxRise
		else if (diff < -maxFall) diff = -maxFall
		y += diff
		data[i] = y
	}

	params.y = y

	return data
}
