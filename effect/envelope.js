/**
 * Attack/release envelope follower
 * Rectifies signal and applies different smoothing for rising (attack) and falling (release).
 * Used as sidechain for compressors, auto-wah, ducking.
 *
 * @module  digital-filter/envelope
 */

let {abs, exp} = Math

export default function envelope (data, params) {
	let fs = params.fs || 44100
	let attack = params.attack || 0.001
	let release = params.release || 0.05

	// Time constant → pole
	let aA = exp(-1 / (attack * fs))
	let aR = exp(-1 / (release * fs))

	let env = params.env != null ? params.env : 0

	for (let i = 0, l = data.length; i < l; i++) {
		let x = abs(data[i])
		if (x > env) {
			env = aA * env + (1 - aA) * x
		} else {
			env = aR * env + (1 - aR) * x
		}
		data[i] = env
	}

	params.env = env

	return data
}
