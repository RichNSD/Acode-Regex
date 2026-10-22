/**
 * Shows the plugin icon for regex files in the file browser and editor tabs.
 *
 * Acode's built-in icon theme gives each file icon the classes
 * `file file_type_<language> file_type_<extension>` and draws an icon-font
 * glyph in `::before`. This stylesheet swaps that glyph for our SVG, styled
 * the way Acode styles image icons from icon-theme plugins. Icon themes from
 * other plugins use their own classes and are left alone.
 */
import iconSvg from "../assets/icon.svg";
import { LANGUAGES } from "./languages.js";

const STYLE_ID = "richnsd-regex-file-icon";

function iconClasses() {
	const types = new Set();
	for (const spec of LANGUAGES) {
		types.add(spec.id);
		for (const ext of spec.extensions) types.add(ext);
	}
	return [...types].map((type) => `.file.file_type_${type}`);
}

export function addFileIconStyle() {
	if (document.getElementById(STYLE_ID)) return;
	const url = `data:image/svg+xml;base64,${btoa(iconSvg)}`;
	const classes = iconClasses();
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
${classes.join(",")}{display:inline-flex;align-items:center;justify-content:center;}
${classes.map((c) => `${c}::before`).join(",")}{content:"";display:block;width:1em;height:1em;background:url(${url}) no-repeat center / contain;}
`;
	document.head.append(style);
}

export function removeFileIconStyle() {
	document.getElementById(STYLE_ID)?.remove();
}
