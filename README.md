# Regular Expression for Acode

A **Regular Expression** language for [Acode](https://acode.app), adapted from the
Sublime Text definitions that Textastic uses. Open a `.re` or `.regex` file and you
get syntax highlighting for the regex itself, as a scratchpad for writing and
checking long expressions. It doesn't run, test or evaluate anything, and it
doesn't add highlighting to other languages.

## Features

- **Highlighting** driven by the original `RegExp.sublime-syntax` (PCRE syntax,
  the same definition Sublime and Textastic bind to `.re`), including:
  groups, named groups, lookarounds, inline modes such as `(?i)`, conditionals,
  recursion, backtracking verbs, character sets with ranges and POSIX classes,
  escapes, quantifiers (lazy and possessive), back-references, `(?#…)` comments,
  `#` comments in `(?x)` mode, and errors such as a leading quantifier or an
  unmatched `)`.
- **File types:** `.re` (from the Sublime definition) and `.regex`.
- **Other flavours:** *Regular Expression (JavaScript)* and *Regular Expression
  (Python)* come from Sublime's two embedded regex syntaxes. They aren't tied to
  a file extension. Pick them from Acode's language selector.
- **Completions** appear only after regex-specific prefixes, and each flavour
  gets its own list:
  - `\` gives escapes and classes (`\d`, `\p{…}`, `\k<name>`, …)
  - `(?` gives group constructs (`(?:…)`, `(?<name>…)`, `(?<=…)`, `(?(1)…|…)`, …)
  - `(*` gives backtracking verbs
  - `[:` inside a set gives POSIX classes

  Named groups you've already written are offered as back-references.
- Auto-closing is limited to `(`, `[` and `{`, because quotes in a regex are
  literal characters.

Colours come from your Acode theme. Scopes are mapped the way TextMate and
Sublime themes treat them: `keyword.*` gets the keyword colour, `constant.*` the
constant colour, `comment.*` the comment colour, and so on.

## Build

Requires Node.js 18+.

```sh
npm install
npm test        # optional: runs the highlighter and completion tests
npm run build   # writes dist/main.js and plugin.zip
```

## Install on your phone

Requires Acode **1.12.0 or newer**, the CodeMirror-based editor.

**Option A: copy the zip**

1. Copy `plugin.zip` to the phone using any method (USB, Google Drive,
   LocalSend, etc.).
2. In Acode, open **Settings → Plugins** and tap **+** (top right), then **Local**.
3. Select `plugin.zip`.

**Option B: install over Wi-Fi (handy while iterating)**

1. On the computer, run `npm run dev`. It rebuilds on every change and serves
   the project on port 3000.
2. Find the computer's LAN IP address (macOS: `ipconfig getifaddr en0`).
3. In Acode, open **Settings → Plugins**, tap **+**, then **Remote**, and enter
   `http://<that-ip>:3000/plugin.zip`. The phone must be on the same network.
4. After making a change, reinstall it the same way.

## Test it

1. Create or open a file ending in `.re` or `.regex`. You can copy over
   [`examples/test.re`](examples/test.re).
2. The language shown for the file should be **Regular Expression**, and the
   regex should be highlighted.
3. Type `\`, `(?` or `[[:` to see completions. If they don't appear while you
   type, make sure live autocompletion is turned on in Acode's editor settings.
4. To try the other flavours, open the language selector and choose
   *Regular Expression (JavaScript)* or *(Python)*.

If a `.re` file still opens as something else, you probably chose a different
language for `.re` files in Acode earlier. Pick **Regular Expression** from
the language selector to replace that choice.

## How it works

`src/sublime/engine.js` reads the `.sublime-syntax` files in `sublime/` without
changing them and runs them as a CodeMirror stream parser. It follows Sublime's
context stack (`push`, `set`, `pop`, `include`, `meta_scope`, `captures`).
`src/sublime/oniguruma.js` converts the few Oniguruma regex features that
JavaScript lacks, such as `\h`, `(?x)` and a leading `]` in a class. CodeMirror
itself is not bundled. The plugin uses Acode's own copy through
`acode.require`.
