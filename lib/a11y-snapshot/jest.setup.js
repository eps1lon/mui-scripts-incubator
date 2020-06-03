// https://estada.ch/2019/6/10/javascript-arrayprototypeflatmap-polyfill/
// BEGIN polyfill_flatMap
if (!Array.prototype.flatMap) {
	Object.defineProperty(Array.prototype, "flatMap", {
		value: function (callback, thisArg) {
			var self = thisArg || this;
			if (self === null) {
				throw new TypeError(
					"Array.prototype.flatMap " + "called on null or undefined"
				);
			}
			if (typeof callback !== "function") {
				throw new TypeError(callback + " is not a function");
			}

			var list = [];

			// 1. Let O be ? ToObject(this value).
			var o = Object(self);

			// 2. Let len be ? ToLength(? Get(O, "length")).
			var len = o.length >>> 0;

			for (var k = 0; k < len; ++k) {
				if (k in o) {
					var part_list = callback.call(self, o[k], k, o);
					list = list.concat(part_list);
				}
			}

			return list;
		},
	});
}
