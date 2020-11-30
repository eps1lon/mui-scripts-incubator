const { toMatchSnapshot } = require("jest-snapshot");

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

expect.extend({
	/**
	 *
	 * @param {import('axe-core').AxeResults} axeResults
	 * @param {string} [hint]
	 */
	toMatchAxeSnapshot(axeResults, hint) {
		const received = axeResults.violations
			.filter((violation) => {
				// Filter all until axe-core rates them by contrast ration difference.
				// Right now 4.49 contrast-ratio will be considered "serious".
				return violation.id !== "color-contrast";
			})
			.map((violation) => {
				return {
					id: violation.id,
					canMismatch__helpUrl: violation.helpUrl,
					nodes: violation.nodes.flatMap((node) => {
						return node.target;
					}),
				};
			});
		if (arguments.length === 1) {
			// toMatchSnapshot relies on call-arity
			return toMatchSnapshot.call(this, received);
		} else {
			return toMatchSnapshot.call(this, received, hint);
		}
	},
});
