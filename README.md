# Regular Expression for Acode

A **Regular Expression** language for [Acode](https://acode.app), adapted from the
Sublime Text definitions that the Textastic app (for iOS & MacOS) uses. Open a `.re` or `.regex` file and you
get syntax highlighting for the regex itself, as a scratchpad for writing and
checking long expressions. It doesn't run, test or evaluate anything, and it
doesn't add highlighting to other languages.

This is the Acode companion to the [VSCode plugin](https://github.com/RichNSD/VSCode-Regex) and (generally) behaves the same way.

## Features

- **Highlighting** driven by the original `RegExp.sublime-syntax` (PCRE syntax, the same definition Sublime and Textastic bind to `.re`), including: groups, named groups, lookarounds, inline modes such as `(?i)`, conditionals, recursion, backtracking verbs, character sets with ranges and POSIX classes, escapes, quantifiers (lazy and possessive), back-references, `(?#…)` comments, `#` comments in `(?x)` mode, and errors such as a leading quantifier or an unmatched `)`.
- **File types:** `.re` (from the Sublime definition) and `.regex`.
- **Other flavours:** *Regular Expression (JavaScript)* and *Regular Expression (Python)* come from Sublime's two embedded regex syntaxes. They aren't tied to a file extension. Pick them from Acode's language selector.
- **Completions** appear only after regex-specific prefixes, and each flavour gets its own list:
  - `\` gives escapes and classes (`\d`, `\p{…}`, `\k<name>`, …)
  - `(?` gives group constructs (`(?:…)`, `(?<name>…)`, `(?<=…)`, `(?(1)…|…)`, …)
  - `(*` gives backtracking verbs
  - `[:` inside a set gives POSIX classes
 Named groups you've already written are offered as back-references.
- **File icon:** `.re` and `.regex` files show the plugin's icon in the file browser and editor tabs. This works with Acode's default icon theme. If you pick a different icon theme in Acode, that theme decides the icon.
- Auto-closing is limited to `(`, `[` and `{`, because quotes in a regex are literal characters.

Colours come from your Acode theme. Scopes are mapped the way TextMate and
Sublime themes treat them: `keyword.*` gets the keyword colour, `constant.*` the
constant colour, `comment.*` the comment colour, and so on.


> [!IMPORTANT]
> ### AI Transparency Notice
> This is my first time building an extension/plugin for either Acode or VSCode and I'm trying to use these extensions as a learning experience. So far all of my (self-taught) coding experience has been in the troubleshooting, editing, and fixing of things other people have built from scratch. So, I will admit that Claude Code has done basically all of the work during the initial builds on both versions of this extension as I learn how everything works. However, going forward, the goal is to use as little AI as possible because my goal is to learn how to *actually* be a developer. 

> [!INFO]
> ### The Art is Human-Made 😎
> The logo/icon is something I designed myself though. The design files are free for anyone to use and play with in the repo. you can find them in the `/design` folder, and you can edit them with the awesome new open-source version of Adobe Illustrator: [VectorCraft](https://getartcraft.com/apps/vectorcraft)


## Build

Requires Node.js 18+.

```sh
npm install
npm test        # optional: runs the highlighter and completion tests
npm run build   # writes dist/main.js and plugin.zip
```

## Install on your phone

Requires Acode **1.12.0 or newer**, the CodeMirror-based editor.

**Copy the zip**

1. Copy `plugin.zip` to the phone using any method (USB, Google Drive,  LocalSend, etc.).
2. In Acode, open **Settings → Plugins** and tap **+** (top right), then **Local**.
3. Select `plugin.zip`.



## How it works

`src/sublime/engine.js` reads the `.sublime-syntax` files in `sublime/` without
changing them and runs them as a CodeMirror stream parser. It follows Sublime's
context stack (`push`, `set`, `pop`, `include`, `meta_scope`, `captures`).
`src/sublime/oniguruma.js` converts the few Oniguruma regex features that
JavaScript lacks, such as `\h`, `(?x)` and a leading `]` in a class. CodeMirror
itself is not bundled. The plugin uses Acode's own copy through
`acode.require`.
