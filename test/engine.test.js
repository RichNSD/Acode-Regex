import assert from "node:assert/strict";
import { test } from "node:test";
import { LANGUAGES } from "../src/languages.js";
import { SublimeSyntax } from "../src/sublime/engine.js";
import { translatePattern } from "../src/sublime/oniguruma.js";
import { tokens } from "./helpers.js";

test("translates Oniguruma-only constructs", () => {
	assert.equal(translatePattern(String.raw`x\h\h`), "x[0-9a-fA-F][0-9a-fA-F]");
	assert.equal(translatePattern(String.raw`[\h_]`), "[0-9a-fA-F_]");
	assert.equal(translatePattern(`[^]\\[(]*$`), `[^\\]\\[(]*$`);
	assert.equal(translatePattern(`[]a]`), `[\\]a]`);
	assert.equal(translatePattern("(?x)\n( a | b )  # comment\n c"), "(a|b)c");
	assert.equal(translatePattern("(?x)[ #]"), "[ #]");
	assert.equal(translatePattern("{{a}}+", { a: "x{{b}}", b: "y" }), "(?:x(?:y))+");
	assert.throws(() => translatePattern("{{nope}}"), /Unknown variable/);
});

test("every pattern in every bundled definition compiles", () => {
	for (const spec of LANGUAGES) {
		const syntax = new SublimeSyntax(spec.definition).validate();
		let count = 0;
		for (const ctx of syntax.contexts.values()) count += ctx.patterns.length;
		assert.ok(count > 10, `${spec.id} has patterns`);
	}
});

test("the main definition is the one Sublime binds to .re", () => {
	const main = LANGUAGES.find((spec) => spec.id === "regexp");
	assert.deepEqual(main.definition.file_extensions, ["re"]);
	assert.deepEqual(main.extensions, ["re", "regex"]);
	assert.equal(main.caption, "Regular Expression");
});

const ALPHABET = "()[]{}?*+|^$\\.-:<>=!#'PRk0123abcdhxsw \n";

test("arbitrary input never throws or stalls", () => {
	let seed = 42;
	const random = () => {
		seed = (seed * 1103515245 + 12345) % 2 ** 31;
		return seed / 2 ** 31;
	};
	for (const spec of LANGUAGES) {
		for (let i = 0; i < 300; i++) {
			let doc = "";
			const length = Math.floor(random() * 80);
			for (let j = 0; j < length; j++) doc += ALPHABET[Math.floor(random() * ALPHABET.length)];
			const covered = tokens(spec.flavor, doc).map(([text]) => text).join("");
			assert.ok(covered.length <= doc.length);
		}
	}
});

test("a long line tokenizes quickly", () => {
	const doc = String.raw`(?<a>[a-z\d]+(?:\.[a-z]{2,})*)@`.repeat(400);
	const start = performance.now();
	tokens("pcre", doc);
	assert.ok(performance.now() - start < 2000);
});
