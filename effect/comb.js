/**
 * Comb filter — feedforward (FIR) and feedback (IIR)
 *
 * @module  digital-filter/comb
 */

export default function comb (data, params) {
	let M = params.delay
	let gain = params.gain == null ? .5 : params.gain
	let type = params.type || 'feedforward'

	if (!params.buffer) {
		params.buffer = new Float64Array(M)
		params.ptr = 0
	}
	let buf = params.buffer, ptr = params.ptr

	if (type === 'feedforward') {
		for (let i = 0, l = data.length; i < l; i++) {
			let x = data[i]
			let delayed = buf[ptr]
			buf[ptr] = x
			ptr = (ptr + 1) % M
			data[i] = x + gain * delayed
		}
	} else {
		for (let i = 0, l = data.length; i < l; i++) {
			let x = data[i]
			let delayed = buf[ptr]
			let y = x + gain * delayed
			buf[ptr] = y
			ptr = (ptr + 1) % M
			data[i] = y
		}
	}

	params.ptr = ptr

	return data
}
