import plugin from "../plugin.json";
import { addFileIconStyle, removeFileIconStyle } from "./fileIcon.js";
import { createLanguageSupport, LANGUAGES } from "./languages.js";

class RegexPlugin {
	baseUrl = "";
	#registered = [];

	async init() {
		const editorLanguages = acode.require("editorLanguages");
		for (const spec of LANGUAGES) {
			let support = null;
			editorLanguages.register(
				spec.id,
				spec.extensions.join("|"),
				spec.caption,
				() => (support ??= createLanguageSupport(spec)),
				{ aliases: spec.aliases },
			);
			this.#registered.push(spec.id);
		}
		addFileIconStyle();
		this.#refreshOpenFiles();
	}

	async destroy() {
		const editorLanguages = acode.require("editorLanguages");
		for (const id of this.#registered) editorLanguages.unregister(id);
		this.#registered = [];
		removeFileIconStyle();
		this.#refreshOpenFiles();
	}

	// Acode re-detects modes after start-up plugin loading, but not when the
	// plugin is installed, enabled or removed mid-session.
	#refreshOpenFiles() {
		const manager = window.editorManager;
		if (!manager?.files) return;
		let activeChanged = false;
		for (const file of manager.files) {
			if (file?.type !== "editor" || !/\.(re|regex)$/i.test(file.filename || "")) continue;
			const before = file.currentMode;
			file.setMode();
			if (file === manager.activeFile && file.currentMode !== before) activeChanged = true;
		}
		if (activeChanged) manager.reapplyActiveFile?.();
	}
}

if (window.acode) {
	const regexPlugin = new RegexPlugin();

	acode.setPluginInit(plugin.id, async (baseUrl) => {
		regexPlugin.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
		await regexPlugin.init();
	});

	acode.setPluginUnmount(plugin.id, () => {
		regexPlugin.destroy();
	});
}
