import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenAt, tokens } from "./helpers.js";

const at = (flavor, doc, needle, from) => tokenAt(flavor, doc, needle, from);

test("PCRE: groups, classes, quantifiers, anchors", () => {
	const doc = String.raw`^(?<year>\d{4})-(?:0[1-9]|1[0-2])\.[[:alpha:]a-z\]]+?\k<year>$`;
	assert.equal(at("pcre", doc, "^"), "controlKeyword");
	assert.equal(at("pcre", doc, "("), "controlKeyword");
	assert.equal(at("pcre", doc, "year"), "labelName");
	assert.equal(at("pcre", doc, "\\d"), "controlKeyword");
	assert.equal(at("pcre", doc, "{4}"), "operatorKeyword");
	assert.equal(at("pcre", doc, "?:"), "constant");
	assert.equal(at("pcre", doc, "1-9"), "constant");
	assert.equal(at("pcre", doc, "|"), "operatorKeyword");
	assert.equal(at("pcre", doc, "\\."), "escape");
	assert.equal(at("pcre", doc, ":alpha:"), "atom");
	assert.equal(at("pcre", doc, "\\]"), "escape");
	assert.equal(at("pcre", doc, "+?"), "operatorKeyword");
	assert.equal(at("pcre", doc, "year", doc.indexOf("\\k")), "variableName");
	assert.equal(at("pcre", doc, "$"), "controlKeyword");
	assert.equal(at("pcre", doc, "-"), null, "a literal stays plain");
});

test("PCRE: escaped brackets are not groups", () => {
	const doc = String.raw`\(a\)`;
	assert.deepEqual(tokens("pcre", doc), [
		["\\(", "escape"],
		["\\)", "escape"],
	]);
});

test("PCRE: invalid constructs", () => {
	assert.equal(at("pcre", "*abc", "*"), "invalid");
	assert.equal(at("pcre", "a)", ")"), "invalid");
	assert.equal(at("pcre", "a|+", "+"), "invalid");
	assert.equal(at("pcre", String.raw`\x`, "\\x"), "invalid");
});

test("PCRE: comments, modes, verbs, quoting", () => {
	const doc = String.raw`(?i)a(?#note)(*PRUNE)\Qx\E\x{1F600}`;
	assert.equal(at("pcre", doc, "?i"), "modifier");
	assert.equal(at("pcre", doc, "note"), "blockComment");
	assert.equal(at("pcre", doc, "(?#"), "blockComment");
	assert.equal(at("pcre", doc, "(*PRUNE)"), "controlKeyword");
	assert.equal(at("pcre", doc, "\\Q"), "controlKeyword");
	assert.equal(at("pcre", doc, "\\x{1F600}"), "escape");
});

test("PCRE: extended mode comments end at the newline", () => {
	const doc = "(?x) a+ # one or more a\n  b # then b\nc";
	assert.equal(at("pcre", doc, "# one"), "lineComment");
	assert.equal(at("pcre", doc, "b"), null);
	assert.equal(at("pcre", doc, "# then"), "lineComment");
	assert.equal(at("pcre", doc, "c"), null);
	// Without (?x), # is a literal.
	assert.equal(at("pcre", "a # b", "#"), null);
});

test("PCRE: state carries across lines and blank lines", () => {
	const doc = "(?<name>\n\n  [a-\nz]\n)+";
	assert.equal(at("pcre", doc, "+"), "operatorKeyword");
	assert.equal(at("pcre", doc, ")"), "controlKeyword");
	assert.equal(at("pcre", "(?#\nstill comment\n)x", "still"), "blockComment");
});

test("JavaScript flavour", () => {
	const doc = String.raw`^(?:[a-z\d\-]+)(?=x)\1|\x41{2,}$`;
	assert.equal(at("javascript", doc, "^"), "controlKeyword");
	assert.equal(at("javascript", doc, "("), "controlKeyword");
	assert.equal(at("javascript", doc, "?:"), "constant");
	assert.equal(at("javascript", doc, "["), "controlKeyword");
	assert.equal(at("javascript", doc, "\\-"), "escape");
	assert.equal(at("javascript", doc, "?="), "constant");
	assert.equal(at("javascript", doc, "\\1"), "keyword");
	assert.equal(at("javascript", doc, "\\x41"), "escape");
	assert.equal(at("javascript", doc, "{2,}"), "operatorKeyword");
});

test("Python flavour", () => {
	const doc = String.raw`(?P<word>\w+)\s(?P=word)(?<=a)(?i)  # repeated`;
	assert.equal(at("python", doc, "?P<"), "keyword");
	assert.equal(at("python", doc, "word"), "labelName");
	assert.equal(at("python", doc, "\\w"), "character");
	assert.equal(at("python", doc, "(?P=word)"), "keyword");
	assert.equal(at("python", doc, "?<="), "constant");
	assert.equal(at("python", doc, "(?i)"), "keyword");
	assert.equal(at("python", doc, "# repeated"), "lineComment");
});
