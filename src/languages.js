import { LanguageSupport, StreamLanguage } from "@codemirror/language";
import { regexCompletions } from "./completions.js";
import { styleForScopes, tokenTable } from "./scopes.js";
import { SublimeSyntax } from "./sublime/engine.js";
import pcreDefinition from "../sublime/RegExp.sublime-syntax.json" with { type: "json" };
import javascriptDefinition from "../sublime/Regular Expressions (JavaScript).sublime-syntax.json" with { type: "json" };
import pythonDefinition from "../sublime/Regular Expressions (Python).sublime-syntax.json" with { type: "json" };

/**
 * The Sublime definitions only list `re`; `regex` is added on purpose.
 * The JavaScript and Python variants are `hidden` in Sublime (they are only
 * embedded by other syntaxes), so they get no extensions and are only
 * reachable through Acode's language picker.
 */
export const LANGUAGES = [
	{
		id: "regexp",
		caption: "Regular Expression",
		definition: pcreDefinition,
		extensions: [...(pcreDefinition.file_extensions || []), "regex"],
		aliases: ["regex", "re", "pcre"],
		flavor: "pcre",
	},
	{
		id: "regexp_javascript",
		caption: "Regular Expression (JavaScript)",
		definition: javascriptDefinition,
		extensions: [],
		aliases: ["regex-js", "regexp-js"],
		flavor: "javascript",
	},
	{
		id: "regexp_python",
		caption: "Regular Expression (Python)",
		definition: pythonDefinition,
		extensions: [],
		aliases: ["regex-python", "regexp-python"],
		flavor: "python",
	},
];

export function createLanguageSupport(spec) {
	const syntax = new SublimeSyntax(spec.definition).validate();
	const language = StreamLanguage.define(
		syntax.streamParser({
			name: spec.id,
			styleFor: styleForScopes,
			tokenTable,
			languageData: {
				// Quotes are literal characters in a regex; auto-pairing them only gets in the way.
				closeBrackets: { brackets: ["(", "[", "{"] },
			},
		}),
	);
	return new LanguageSupport(language, [language.data.of({ autocomplete: regexCompletions(spec.flavor) })]);
}
