/**
 * Completions for regex syntax. They only trigger after regex-specific
 * prefixes (`\`, `(?`, `(*`, `[:`) so ordinary literal text never pops up a
 * list. Named groups defined in the document are offered as back-references.
 */
import { snippetCompletion } from "@codemirror/autocomplete";

const PCRE = "pcre";
const JS = "javascript";
const PY = "python";
const ALL = [PCRE, JS, PY];

// [label, detail, flavors, snippet?]
const ESCAPES = [
	["\\d", "digit", ALL],
	["\\D", "non-digit", ALL],
	["\\w", "word character", ALL],
	["\\W", "non-word character", ALL],
	["\\s", "whitespace", ALL],
	["\\S", "non-whitespace", ALL],
	["\\h", "horizontal whitespace", [PCRE]],
	["\\H", "non-horizontal whitespace", [PCRE]],
	["\\v", "vertical whitespace", [PCRE]],
	["\\V", "non-vertical whitespace", [PCRE]],
	["\\R", "any line break", [PCRE]],
	["\\X", "extended grapheme cluster", [PCRE]],
	["\\N", "non-newline", [PCRE]],
	["\\b", "word boundary", ALL],
	["\\B", "non-word boundary", ALL],
	["\\A", "start of subject", [PCRE, PY]],
	["\\z", "end of subject", [PCRE]],
	["\\Z", "end of subject or before final newline", [PCRE, PY]],
	["\\G", "first match position", [PCRE]],
	["\\K", "reset match start", [PCRE]],
	["\\Q", "quote until \\E", [PCRE], "\\Q${}\\E"],
	["\\t", "tab", ALL],
	["\\n", "newline", ALL],
	["\\r", "carriage return", ALL],
	["\\f", "form feed", ALL],
	["\\v", "vertical tab", [JS, PY]],
	["\\e", "escape", [PCRE]],
	["\\a", "bell", [PCRE, PY]],
	["\\0", "null character", [JS]],
	["\\xhh", "hex character", ALL, "\\x${hh}"],
	["\\x{hhhh}", "hex code point", [PCRE], "\\x{${hhhh}}"],
	["\\uhhhh", "unicode character", [JS, PY], "\\u${hhhh}"],
	["\\u{hhhhh}", "unicode code point (u flag)", [JS], "\\u{${hhhhh}}"],
	["\\cX", "control character", [PCRE, JS], "\\c${X}"],
	["\\p{…}", "unicode property", [PCRE, JS], "\\p{${L}}"],
	["\\P{…}", "not unicode property", [PCRE, JS], "\\P{${L}}"],
	["\\k<name>", "named back-reference", [PCRE, JS], "\\k<${name}>"],
	["\\g{n}", "back-reference / relative", [PCRE], "\\g{${1:1}}"],
	["\\g<name>", "subroutine call", [PCRE], "\\g<${name}>"],
];

// [label, detail, flavors, snippet]
const GROUPS = [
	["(?:…)", "non-capturing group", ALL, "(?:${})"],
	["(?<name>…)", "named capture group", [PCRE, JS], "(?<${name}>${})"],
	["(?'name'…)", "named capture group", [PCRE], "(?'${name}'${})"],
	["(?P<name>…)", "named capture group", [PCRE, PY], "(?P<${name}>${})"],
	["(?=…)", "positive lookahead", ALL, "(?=${})"],
	["(?!…)", "negative lookahead", ALL, "(?!${})"],
	["(?<=…)", "positive lookbehind", ALL, "(?<=${})"],
	["(?<!…)", "negative lookbehind", ALL, "(?<!${})"],
	["(?>…)", "atomic group", [PCRE], "(?>${})"],
	["(?#…)", "comment", [PCRE, PY], "(?#${})"],
	["(?i)", "case-insensitive", [PCRE, PY], "(?i)"],
	["(?m)", "multiline", [PCRE, PY], "(?m)"],
	["(?s)", "dot matches newline", [PCRE, PY], "(?s)"],
	["(?x)", "extended (ignore whitespace)", [PCRE, PY], "(?x)"],
	["(?i:…)", "case-insensitive group", [PCRE, PY], "(?i:${})"],
	["(?(1)…|…)", "conditional", [PCRE, PY], "(?(${1:1})${yes}|${no})"],
	["(?(<name>)…|…)", "named conditional", [PCRE], "(?(<${name}>)${yes}|${no})"],
	["(?(DEFINE)…)", "subpattern definitions", [PCRE], "(?(DEFINE)${})"],
	["(?R)", "recurse whole pattern", [PCRE], "(?R)"],
	["(?1)", "recurse group", [PCRE], "(?${1:1})"],
	["(?&name)", "recurse named group", [PCRE], "(?&${name})"],
	["(?P=name)", "named back-reference", [PY], "(?P=${name})"],
];

const VERBS = ["PRUNE", "SKIP", "THEN", "COMMIT", "FAIL", "F", "ACCEPT"];

const POSIX = [
	"alnum", "alpha", "ascii", "blank", "cntrl", "digit", "graph",
	"lower", "print", "punct", "space", "upper", "word", "xdigit",
];

const NAMED_GROUP = /\(\?(?:P?<([A-Za-z_]\w*)>|'([A-Za-z_]\w*)')/g;

function namedGroups(doc) {
	const names = new Set();
	for (const m of doc.matchAll(NAMED_GROUP)) names.add(m[1] || m[2]);
	return [...names];
}

function option(label, detail, apply, boost = 0) {
	return apply && apply !== label
		? snippetCompletion(apply, { label, detail, type: "keyword", boost })
		: { label, detail, type: "keyword", boost };
}

/** True when the character at `pos` is preceded by an odd number of backslashes. */
function isEscaped(state, pos) {
	const line = state.doc.lineAt(pos);
	let count = 0;
	for (let i = pos - 1; i >= line.from && state.sliceDoc(i, i + 1) === "\\"; i--) count++;
	return count % 2 === 1;
}

// When the editor already auto-closed the bracket, drop ours so it isn't doubled.
function withoutClosing(snippet, closing) {
	return snippet.endsWith(closing) ? snippet.slice(0, -closing.length) : snippet;
}

export function regexCompletions(flavor) {
	const escapes = ESCAPES.filter(([, , flavors]) => flavors.includes(flavor));
	const groups = GROUPS.filter(([, , flavors]) => flavors.includes(flavor));

	return (context) => {
		const { state, pos } = context;
		const nextChar = state.sliceDoc(pos, pos + 1);

		const escape = context.matchBefore(/\\[A-Za-z0-9{<]*$/);
		if (escape) {
			// `\\` is an escaped backslash, not the start of an escape sequence.
			if (isEscaped(state, escape.from)) return null;
			const options = escapes.map(([label, detail, , snippet]) => option(label, detail, snippet));
			const names = namedGroups(state.doc.toString());
			if (flavor !== PY) {
				for (const name of names) options.push(option(`\\k<${name}>`, "back-reference", null, 1));
			}
			return { from: escape.from, options, validFor: /^\\[A-Za-z0-9]*$/ };
		}

		const group = context.matchBefore(/\((?:\?[A-Za-z<'=!:#>&(P-]*|\*[A-Z]*)$/);
		if (group && !isEscaped(state, group.from)) {
			const closingAhead = nextChar === ")";
			const fix = (snippet) => (closingAhead ? withoutClosing(snippet, ")") : snippet);
			const options = groups.map(([label, detail, , snippet]) => option(label, detail, fix(snippet)));
			if (flavor === PCRE) {
				for (const verb of VERBS) options.push(option(`(*${verb})`, "backtracking verb", fix(`(*${verb})`)));
			}
			const names = namedGroups(state.doc.toString());
			for (const name of names) {
				if (flavor === PCRE) options.push(option(`(?&${name})`, "recurse group", fix(`(?&${name})`), 1));
				if (flavor === PY) options.push(option(`(?P=${name})`, "back-reference", fix(`(?P=${name})`), 1));
			}
			return { from: group.from, options };
		}

		if (flavor === PCRE) {
			const posix = context.matchBefore(/\[:[a-z]*$/);
			if (posix) {
				// `[[` with auto-closing leaves `]]` ahead; one of them is ours.
				const to = state.sliceDoc(pos, pos + 2) === "]]" ? pos + 1 : pos;
				return {
					from: posix.from,
					to,
					options: POSIX.map((name) => ({ label: `[:${name}:]`, detail: "POSIX class", type: "constant" })),
				};
			}
		}

		return null;
	};
}
