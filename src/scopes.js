/**
 * Maps Sublime/TextMate scope names onto CodeMirror highlight tags, so Acode's
 * themes colour regex tokens the way Sublime and Textastic themes colour the
 * same scopes (e.g. `keyword.*` → keyword colour, `constant.*` → constant).
 */
import { tags as t } from "@lezer/highlight";

// Longest matching prefix wins. Scopes with no entry (meta.*, punctuation.*)
// are transparent and inherit from the enclosing scope, as in TextMate themes.
const SCOPE_TOKENS = [
	["comment.line", "lineComment"],
	["comment.block", "blockComment"],
	["comment", "comment"],
	["invalid", "invalid"],
	["keyword.operator", "operatorKeyword"],
	["keyword.control", "controlKeyword"],
	["keyword", "keyword"],
	["storage.modifier", "modifier"],
	["storage", "keyword"],
	["constant.character.escape", "escape"],
	["constant.character", "character"],
	["constant.other.posix-class", "atom"],
	["constant", "constant"],
	["entity.name", "labelName"],
	["variable", "variableName"],
	// The JavaScript and Python syntaxes scope groups and sets as punctuation,
	// which themes rarely colour. Give them the colours RegExp.sublime-syntax
	// uses for the same constructs (keyword.control.group/set,
	// constant.other.assertion) so all three flavours look alike.
	["punctuation.definition.group", "controlKeyword"],
	["punctuation.definition.character-class", "controlKeyword"],
	["punctuation.definition.group.no-capture", "constant"],
	["punctuation.definition.group.assertion", "constant"],
	["punctuation.definition.group.capture", "keyword"],
	["meta.assertion", "constant"],
];

export const tokenTable = {
	lineComment: t.lineComment,
	blockComment: t.blockComment,
	comment: t.comment,
	invalid: t.invalid,
	operatorKeyword: t.operatorKeyword,
	controlKeyword: t.controlKeyword,
	keyword: t.keyword,
	modifier: t.modifier,
	escape: t.escape,
	character: t.character,
	atom: t.atom,
	constant: t.constant(t.name),
	labelName: t.labelName,
	variableName: t.variableName,
};

const COMMENT_TOKENS = new Set(["lineComment", "blockComment", "comment"]);
const tokenCache = new Map();

export function tokenForScope(scope) {
	let token = tokenCache.get(scope);
	if (token !== undefined) return token;
	token = null;
	let bestLength = -1;
	for (const [prefix, name] of SCOPE_TOKENS) {
		if ((scope === prefix || scope.startsWith(`${prefix}.`)) && prefix.length > bestLength) {
			token = name;
			bestLength = prefix.length;
		}
	}
	tokenCache.set(scope, token);
	return token;
}

/**
 * Picks the token for a scope stack (outermost first). Comments and invalid
 * code win wherever they appear in the stack, the way themes give them
 * precedence; otherwise the innermost scope with a mapping decides.
 */
export function styleForScopes(scopes) {
	let innermost = null;
	let comment = null;
	for (const scope of scopes) {
		const token = tokenForScope(scope);
		if (!token) continue;
		if (token === "invalid") return token;
		if (COMMENT_TOKENS.has(token)) comment = token;
		innermost = token;
	}
	return comment ?? innermost;
}
