import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { createLanguageSupport, LANGUAGES } from "../src/languages.js";

export const languages = Object.fromEntries(LANGUAGES.map((spec) => [spec.flavor, spec]));

export function editorState(flavor, doc) {
	return EditorState.create({ doc, extensions: [createLanguageSupport(languages[flavor])] });
}

/** Returns [[text, tokenName], ...] for every highlighted token in `doc`. */
export function tokens(flavor, doc) {
	const state = editorState(flavor, doc);
	const tree = ensureSyntaxTree(state, doc.length, 5000);
	const out = [];
	tree.iterate({
		enter(node) {
			if (node.type.isTop) return;
			out.push([doc.slice(node.from, node.to), node.type.name]);
		},
	});
	return out;
}

/** Token name covering the first occurrence of `needle` (after `from`). */
export function tokenAt(flavor, doc, needle, from = 0) {
	const index = doc.indexOf(needle, from);
	if (index < 0) throw new Error(`"${needle}" not in doc`);
	const state = editorState(flavor, doc);
	const tree = ensureSyntaxTree(state, doc.length, 5000);
	const node = tree.resolveInner(index, 1);
	return node.type.isTop ? null : node.type.name;
}
