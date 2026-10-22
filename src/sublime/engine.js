/**
 * A small interpreter for .sublime-syntax definitions (in their JSON form)
 * that runs as a CodeMirror 6 StreamParser.
 *
 * It implements the subset of the format the bundled regex syntaxes use:
 * contexts, `match`, `scope`, `captures`, `push` / `set` / `pop`, `include`,
 * `meta_scope`, `meta_content_scope`, multi-context push/set, anonymous
 * contexts and `variables`. Matching follows Sublime's rules: of all patterns
 * in the current context, the one whose match starts earliest wins, ties go
 * to the pattern listed first, and each line is matched with its trailing
 * newline so patterns such as `\n` and `$` behave as they do in Sublime.
 */
import { translatePattern } from "./oniguruma.js";

const SUPPORTS_INDICES = (() => {
	try {
		new RegExp("", "d");
		return true;
	} catch {
		return false;
	}
})();
const FLAGS = SUPPORTS_INDICES ? "gmd" : "gm";

// Consecutive zero-width actions allowed at one position before the engine
// forces progress. Sublime has a similar guard against push/pop loops.
const MAX_ZERO_WIDTH = 64;

const splitScopes = (scope) => (scope ? scope.trim().split(/\s+/) : []);

class Context {
	constructor(syntax, name, rules) {
		this.syntax = syntax;
		this.name = name;
		this.metaScope = [];
		this.metaContentScope = [];
		this.rules = [];
		for (const rule of rules) {
			if ("meta_scope" in rule) this.metaScope = splitScopes(rule.meta_scope);
			else if ("meta_content_scope" in rule)
				this.metaContentScope = splitScopes(rule.meta_content_scope);
			else this.rules.push(rule);
		}
		this._patterns = null;
	}

	/** Compiled match rules with includes expanded, in priority order. */
	get patterns() {
		if (!this._patterns) this._patterns = this.syntax.expand(this, new Set());
		return this._patterns;
	}
}

export class SublimeSyntax {
	/**
	 * @param {object} definition parsed .sublime-syntax JSON
	 */
	constructor(definition) {
		this.name = definition.name;
		this.scope = definition.scope;
		this.fileExtensions = definition.file_extensions || [];
		this.variables = definition.variables || {};
		this.contexts = new Map();
		this.anonymous = new WeakMap();
		this.compiledRules = new WeakMap();
		for (const [name, rules] of Object.entries(definition.contexts)) {
			this.contexts.set(name, new Context(this, name, rules));
		}
		if (!this.contexts.has("main")) throw new Error(`${this.name}: no main context`);
	}

	get main() {
		return this.contexts.get("main");
	}

	resolve(ref) {
		if (typeof ref === "string") {
			const ctx = this.contexts.get(ref);
			if (!ctx) throw new Error(`${this.name}: unknown context "${ref}"`);
			return ctx;
		}
		let ctx = this.anonymous.get(ref);
		if (!ctx) {
			ctx = new Context(this, null, ref);
			this.anonymous.set(ref, ctx);
		}
		return ctx;
	}

	/** Resolves a push/set target into the list of contexts to push (last on top). */
	resolveTargets(target) {
		const isMulti =
			Array.isArray(target) &&
			target.length > 0 &&
			target.every((item) => typeof item === "string" || Array.isArray(item));
		return isMulti ? target.map((t) => this.resolve(t)) : [this.resolve(target)];
	}

	expand(context, seen) {
		if (seen.has(context)) return [];
		seen.add(context);
		const out = [];
		for (const rule of context.rules) {
			if ("include" in rule) out.push(...this.expand(this.resolve(rule.include), seen));
			else if ("match" in rule) out.push(this.compileRule(rule));
		}
		seen.delete(context);
		return out;
	}

	compileRule(rule) {
		let compiled = this.compiledRules.get(rule);
		if (compiled) return compiled;

		const source = translatePattern(rule.match, this.variables);
		let action = null;
		if (rule.push !== undefined) action = { type: "push", target: rule.push };
		else if (rule.set !== undefined) action = { type: "set", target: rule.set };
		else if (rule.pop) action = { type: "pop", count: rule.pop === true ? 1 : Number(rule.pop) };

		const captures = [];
		for (const [group, scope] of Object.entries(rule.captures || {})) {
			captures.push({ group: Number(group), scopes: splitScopes(scope) });
		}
		captures.sort((a, b) => a.group - b.group);

		compiled = {
			source: rule.match,
			regex: new RegExp(source, FLAGS),
			scopes: splitScopes(rule.scope),
			captures,
			action,
			_targets: null,
		};
		this.compiledRules.set(rule, compiled);
		return compiled;
	}

	targetsOf(compiled) {
		if (!compiled._targets) compiled._targets = this.resolveTargets(compiled.action.target);
		return compiled._targets;
	}

	/** Compiles every reachable rule so definition errors surface immediately. */
	validate() {
		for (const ctx of this.contexts.values()) {
			for (const rule of ctx.patterns) if (rule.action?.target) this.targetsOf(rule);
		}
		return this;
	}

	/**
	 * Builds a CodeMirror StreamParser.
	 * @param {(scopes: string[]) => string | null} styleFor maps a scope stack
	 *   (outermost first) to a token name from the parser's tokenTable
	 */
	streamParser({ name, styleFor, tokenTable, languageData }) {
		const syntax = this;
		const styleCache = new Map();
		const style = (scopes) => {
			const key = scopes.join(" ");
			let value = styleCache.get(key);
			if (value === undefined) {
				value = styleFor(scopes) ?? null;
				styleCache.set(key, value);
			}
			return value;
		};

		return {
			name,
			tokenTable,
			languageData,
			startState: () => ({ stack: [syntax.main], queue: [], nl: false }),
			copyState: (state) => ({ stack: state.stack.slice(), queue: state.queue.slice(), nl: state.nl }),
			blankLine: (state) => {
				state.nl = false;
				syntax.endOfLine(state, "\n", 0);
			},
			token: (stream, state) => syntax.token(stream, state, style),
		};
	}

	findMatch(context, text, pos) {
		let best = null;
		let bestRule = null;
		for (const rule of context.patterns) {
			rule.regex.lastIndex = pos;
			const m = rule.regex.exec(text);
			if (!m) continue;
			// A zero-width match that changes nothing would loop forever.
			if (m[0].length === 0 && !rule.action) continue;
			if (!best || m.index < best.index) {
				best = m;
				bestRule = rule;
				if (m.index === pos) break;
			}
		}
		return best ? { m: best, rule: bestRule } : null;
	}

	/** Applies a rule's stack action and returns the scopes for its matched text. */
	apply(state, rule) {
		const { stack } = state;
		const { action } = rule;
		let base;

		if (!action) {
			base = stackScopes(stack, stack.length);
		} else if (action.type === "pop") {
			const top = stack[stack.length - 1];
			base = [...stackScopes(stack, stack.length - 1), ...top.metaScope];
			const count = Math.min(action.count, stack.length - 1);
			stack.length -= count;
		} else {
			const targets = this.targetsOf(rule);
			if (action.type === "set" && stack.length > 1) stack.pop();
			base = stackScopes(stack, stack.length);
			for (const ctx of targets) {
				base.push(...ctx.metaScope);
				stack.push(ctx);
			}
		}
		return base;
	}

	token(stream, state, style) {
		if (stream.sol() && !state.queue.length) state.nl = false;

		const line = stream.string;
		const len = line.length;
		const finish = (value) => {
			if (stream.pos >= len && !state.nl) this.endOfLine(state, `${line}\n`, len);
			return value;
		};

		if (state.queue.length) {
			const next = state.queue.shift();
			stream.pos = next.end;
			return finish(next.style);
		}

		const text = `${line}\n`;
		let zeroWidth = 0;

		for (;;) {
			const pos = stream.pos;
			const top = state.stack[state.stack.length - 1];
			const found = this.findMatch(top, text, pos);

			if (!found || found.m.index >= len) {
				stream.pos = len;
				return finish(style(stackScopes(state.stack, state.stack.length)));
			}
			if (found.m.index > pos) {
				// Unmatched text before the next match takes the context's scopes.
				stream.pos = found.m.index;
				return finish(style(stackScopes(state.stack, state.stack.length)));
			}

			const { m, rule } = found;
			const base = this.apply(state, rule);
			let end = pos + m[0].length;
			if (end > len) {
				end = len;
				state.nl = true;
			}

			if (end === pos) {
				if (++zeroWidth > MAX_ZERO_WIDTH) {
					stream.pos = pos + 1;
					return finish(style(stackScopes(state.stack, state.stack.length)));
				}
				continue;
			}

			const segments = captureSegments(m, rule, base, pos, end, style);
			const first = segments.shift();
			state.queue.push(...segments);
			stream.pos = first.end;
			return finish(first.style);
		}
	}

	/** Lets rules match the newline at the end of a line (e.g. `\n` pops). */
	endOfLine(state, text, len) {
		for (let i = 0; i < MAX_ZERO_WIDTH; i++) {
			const found = this.findMatch(state.stack[state.stack.length - 1], text, len);
			if (!found || found.m.index !== len) return;
			this.apply(state, found.rule);
			if (found.m[0].length > 0) return;
		}
	}
}

function stackScopes(stack, depth) {
	const scopes = [];
	for (let i = 0; i < depth; i++) {
		const ctx = stack[i];
		scopes.push(...ctx.metaScope, ...ctx.metaContentScope);
	}
	return scopes;
}

/** Splits a match into styled runs according to its capture groups. */
function captureSegments(m, rule, base, start, end, style) {
	const matchScopes = [...base, ...rule.scopes];
	const spans = [];
	if (rule.captures.length && m.indices) {
		for (const { group, scopes } of rule.captures) {
			const range = m.indices[group];
			if (!range || range[0] === range[1]) continue;
			spans.push({ from: Math.max(range[0], start), to: Math.min(range[1], end), scopes });
		}
	}

	const cuts = new Set([start, end]);
	for (const span of spans) {
		if (span.from < span.to) cuts.add(span.from).add(span.to);
	}
	const points = [...cuts].sort((a, b) => a - b);

	const segments = [];
	for (let i = 0; i < points.length - 1; i++) {
		const from = points[i];
		const to = points[i + 1];
		const scopes = [...matchScopes];
		for (const span of spans) {
			if (span.from <= from && span.to >= to) scopes.push(...span.scopes);
		}
		const value = style(scopes);
		const last = segments[segments.length - 1];
		if (last && last.style === value) last.end = to;
		else segments.push({ end: to, style: value });
	}
	return segments;
}
