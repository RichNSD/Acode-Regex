import assert from "node:assert/strict";
import { test } from "node:test";
import { CompletionContext } from "@codemirror/autocomplete";
import { regexCompletions } from "../src/completions.js";
import { editorState } from "./helpers.js";

function complete(flavor, doc, { explicit = false } = {}) {
	const pos = doc.indexOf("|");
	const text = doc.slice(0, pos) + doc.slice(pos + 1);
	const state = editorState(flavor, text);
	const result = regexCompletions(flavor)(new CompletionContext(state, pos, explicit));
	return result && { ...result, labels: result.options.map((o) => o.label) };
}

test("offers escapes after a backslash, by flavour", () => {
	const pcre = complete("pcre", "a\\|");
	assert.equal(pcre.from, 1);
	assert.ok(pcre.labels.includes("\\d"));
	assert.ok(pcre.labels.includes("\\K"));
	const js = complete("javascript", "a\\|");
	assert.ok(js.labels.includes("\\u{hhhhh}"));
	assert.ok(!js.labels.includes("\\K"));
	const py = complete("python", "\\|");
	assert.ok(py.labels.includes("\\A"));
	assert.ok(!py.labels.includes("\\k<name>"));
});

test("does not complete after an escaped backslash or on plain text", () => {
	assert.equal(complete("pcre", "\\\\|"), null);
	assert.equal(complete("pcre", "abc|"), null);
	assert.equal(complete("pcre", "(|"), null);
	assert.equal(complete("pcre", "\\(?|"), null);
});

test("offers group constructs after (?", () => {
	const result = complete("pcre", "x(?|");
	assert.equal(result.from, 1);
	assert.ok(result.labels.includes("(?:…)"));
	assert.ok(result.labels.includes("(*PRUNE)"));
	assert.ok(!complete("javascript", "(?|").labels.includes("(?>…)"));
	assert.ok(complete("python", "(?|").labels.includes("(?P<name>…)"));
});

/** Applies the completion labelled `label` at the `|` and returns the new document. */
function accept(flavor, doc, label) {
	const result = complete(flavor, doc);
	const option = result.options.find((o) => o.label === label);
	const pos = doc.indexOf("|");
	const view = { state: editorState(flavor, doc.replace("|", "")) };
	view.dispatch = (tr) => (view.state = (tr.state ? tr : view.state.update(tr)).state);
	if (typeof option.apply === "function") option.apply(view, option, result.from, result.to ?? pos);
	else view.dispatch({ changes: { from: result.from, to: result.to ?? pos, insert: option.apply ?? option.label } });
	return view.state.doc.toString();
}

test("inserts group snippets without doubling an auto-closed parenthesis", () => {
	assert.equal(accept("pcre", "a(?|", "(?:…)"), "a(?:)");
	assert.equal(accept("pcre", "a(?|)", "(?:…)"), "a(?:)");
	assert.equal(accept("pcre", "(?|)", "(?<name>…)"), "(?<name>)");
	assert.equal(accept("pcre", "(*|)", "(*PRUNE)"), "(*PRUNE)");
	assert.equal(accept("pcre", "\\|", "\\d"), "\\d");
	assert.equal(accept("pcre", "\\|", "\\p{…}"), "\\p{L}");
	assert.equal(accept("pcre", "[[:al|]]", "[:alpha:]"), "[[:alpha:]]");
});

test("suggests named groups from the document", () => {
	const doc = "(?<year>\\d+)(?'month'\\d+)(?P<day>\\d+)\\k|";
	const labels = complete("pcre", doc).labels;
	assert.ok(labels.includes("\\k<year>"));
	assert.ok(labels.includes("\\k<month>"));
	assert.ok(labels.includes("\\k<day>"));
	assert.ok(complete("pcre", `${doc.slice(0, -3)}(?|`).labels.includes("(?&year)"));
	assert.ok(complete("python", "(?P<w>a)(?|").labels.includes("(?P=w)"));
});

test("POSIX classes inside sets (PCRE only)", () => {
	const result = complete("pcre", "[[:al|]]");
	assert.equal(result.from, 1);
	assert.equal(result.to, 6, "swallows the auto-closed ]");
	assert.ok(result.labels.includes("[:alpha:]"));
	assert.equal(complete("pcre", "[[:al|]").to, 5);
	assert.equal(complete("javascript", "[[:|"), null);
});
