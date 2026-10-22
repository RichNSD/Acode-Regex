/**
 * Translates the Oniguruma regex dialect used by .sublime-syntax files into
 * JavaScript RegExp source. Only the differences that actually occur in
 * Sublime's syntax definitions are handled:
 *
 * - `{{variable}}` substitution (recursive, as Sublime does)
 * - `(?x)` extended mode: whitespace and `#` comments are stripped
 * - `\h` / `\H` (hex digit) which JS has no shorthand for
 * - a `]` as the first character of a class (`[]...]`, `[^]...]`) is a
 *   literal in Oniguruma but terminates/alters the class in JS
 */

const HEX = "0-9a-fA-F";

export function substituteVariables(source, variables = {}, depth = 0) {
	if (depth > 20) throw new Error(`Variable recursion too deep in: ${source}`);
	return source.replace(/\{\{(\w+)\}\}/g, (_, name) => {
		if (!(name in variables)) throw new Error(`Unknown variable {{${name}}}`);
		return `(?:${substituteVariables(variables[name], variables, depth + 1)})`;
	});
}

export function translatePattern(source, variables) {
	let src = substituteVariables(source, variables);
	let extended = false;
	if (src.startsWith("(?x)")) {
		extended = true;
		src = src.slice(4);
	}

	let out = "";
	let inClass = false;
	let classStart = false; // directly after `[` or `[^`

	for (let i = 0; i < src.length; i++) {
		const ch = src[i];

		if (ch === "\\") {
			const next = src[i + 1] ?? "";
			i++;
			classStart = false;
			if (next === "h") out += inClass ? HEX : `[${HEX}]`;
			else if (next === "H") out += inClass ? `\\x00-\\x2F\\x3A-\\x40\\x47-\\x60\\x67-\\uFFFF` : `[^${HEX}]`;
			else out += `\\${next}`;
			continue;
		}

		if (inClass) {
			if (ch === "]" && classStart) {
				out += "\\]";
			} else if (ch === "^" && classStart && out.endsWith("[")) {
				out += ch;
				continue; // still at class start
			} else {
				if (ch === "]") inClass = false;
				out += ch;
			}
			classStart = false;
			continue;
		}

		if (extended) {
			if (/\s/.test(ch)) continue;
			if (ch === "#") {
				while (i < src.length && src[i] !== "\n") i++;
				continue;
			}
		}

		if (ch === "[") {
			inClass = true;
			classStart = true;
		}
		out += ch;
	}

	return out;
}
