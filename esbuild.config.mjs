import * as esbuild from "esbuild";
import { execFile } from "node:child_process";

const isServe = process.argv.includes("--serve");

// Acode ships its own CodeMirror and exposes it through acode.require().
// Plugins must use those instances: a second bundled copy of @codemirror/state
// or @lezer/highlight would not be recognised by the editor.
const SHARED_MODULES = /^@(codemirror\/(autocomplete|commands|language|lint|search|state|view)|lezer\/(common|highlight|lr))$/;

const acodeModules = {
	name: "acode-modules",
	setup(build) {
		build.onResolve({ filter: SHARED_MODULES }, (args) => ({ path: args.path, namespace: "acode-module" }));
		build.onLoad({ filter: /.*/, namespace: "acode-module" }, (args) => ({
			contents: `module.exports = acode.require(${JSON.stringify(args.path)});`,
			loader: "js",
		}));
	},
};

const zipPlugin = {
	name: "zip-plugin",
	setup(build) {
		build.onEnd((result) => {
			if (result.errors.length) return;
			execFile(process.execPath, ["./pack-zip.js"], (err, stdout) => {
				if (err) console.error("Error packing zip:", err);
				else console.log(stdout.trim());
			});
		});
	},
};

const buildConfig = {
	entryPoints: { main: "src/main.js" },
	bundle: true,
	minify: true,
	platform: "browser",
	target: ["chrome90"],
	format: "iife",
	logLevel: "info",
	outdir: "dist",
	plugins: [acodeModules, zipPlugin],
};

if (isServe) {
	const ctx = await esbuild.context(buildConfig);
	await ctx.watch();
	const { port } = await ctx.serve({ servedir: ".", port: 3000 });
	console.log(`Serving on port ${port} — in Acode, install from http://<this-computer-ip>:${port}/plugin.zip`);
} else {
	await esbuild.build(buildConfig);
}
