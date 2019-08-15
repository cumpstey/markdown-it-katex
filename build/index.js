"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const katex_1 = tslib_1.__importDefault(require("katex"));
/**
 * Test if potential opening or closing delimiter.
 *
 * Opening delimiter cannot be followed by whitespace.
 *
 * Closing delimiter cannot be preceded by whitespace, or followed by a digit.
 *
 * Assumes that there is a `$` at `state.src[pos]`.
 * @param state
 * @param pos
 */
function isValidDelimiter(state, pos) {
    var prevChar, nextChar, max = state.posMax, can_open = true, can_close = true;
    prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
    nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1;
    // Check non-whitespace conditions for opening and closing, and
    // check that closing delimiter isn't followed by a number
    if (prevChar === 0x20 /* " " */ || prevChar === 0x09 /* \t */ ||
        (nextChar >= 0x30 /* "0" */ && nextChar <= 0x39 /* "9" */)) {
        can_close = false;
    }
    if (nextChar === 0x20 /* " " */ || nextChar === 0x09 /* \t */) {
        can_open = false;
    }
    return {
        can_open: can_open,
        can_close: can_close
    };
}
/**
 * Parses inline maths, delimited by `$...$`.
 * @param state
 * @param silent
 */
function math_inline(state, silent) {
    var start, match, token, res, pos;
    if (state.src[state.pos] !== "$") {
        return false;
    }
    res = isValidDelimiter(state, state.pos);
    if (!res.can_open) {
        if (!silent) {
            state.pending += "$";
        }
        state.pos += 1;
        return true;
    }
    // First check for and bypass all properly escaped delimiters
    // This loop will assume that the first leading backtick can not
    // be the first character in state.src, which is known since
    // we have found an opening delimiter already.
    start = state.pos + 1;
    match = start;
    while ((match = state.src.indexOf("$", match)) !== -1) {
        // Found potential $, look for escapes, pos will point to
        // first non escape when complete
        pos = match - 1;
        while (state.src[pos] === "\\") {
            pos -= 1;
        }
        // Even number of escapes, potential closing delimiter found
        if (((match - pos) % 2) == 1) {
            break;
        }
        match += 1;
    }
    // No closing delimiter found.  Consume $ and continue.
    if (match === -1) {
        if (!silent) {
            state.pending += "$";
        }
        state.pos = start;
        return true;
    }
    // Check if we have empty content, ie: $$.  Do not parse.
    if (match - start === 0) {
        if (!silent) {
            state.pending += "$$";
        }
        state.pos = start + 1;
        return true;
    }
    // Check for valid closing delimiter
    res = isValidDelimiter(state, match);
    if (!res.can_close) {
        if (!silent) {
            state.pending += "$";
        }
        state.pos = start;
        return true;
    }
    if (!silent) {
        token = state.push('math_inline', 'math', 0);
        token.markup = "$";
        token.content = state.src.slice(start, match);
    }
    state.pos = match + 1;
    return true;
}
/**
 * Parses block maths, delimited by `$$...$$`.
 * @param state
 * @param start
 * @param end
 * @param silent
 */
function math_block(state, start, end, silent) {
    var firstLine, lastLine, next, lastPos, found = false, token, pos = state.bMarks[start] + state.tShift[start], max = state.eMarks[start];
    if (pos + 2 > max) {
        return false;
    }
    if (state.src.slice(pos, pos + 2) !== '$$') {
        return false;
    }
    pos += 2;
    firstLine = state.src.slice(pos, max);
    if (silent) {
        return true;
    }
    if (firstLine.trim().slice(-2) === '$$') {
        // Single line expression
        firstLine = firstLine.trim().slice(0, -2);
        found = true;
    }
    for (next = start; !found;) {
        next++;
        if (next >= end) {
            break;
        }
        pos = state.bMarks[next] + state.tShift[next];
        max = state.eMarks[next];
        if (pos < max && state.tShift[next] < state.blkIndent) {
            // non-empty line with negative indent should stop the list:
            break;
        }
        if (state.src.slice(pos, max).trim().slice(-2) === '$$') {
            lastPos = state.src.slice(0, max).lastIndexOf('$$');
            lastLine = state.src.slice(pos, lastPos);
            found = true;
        }
    }
    state.line = next + 1;
    token = state.push('math_block', 'math', 0);
    token.block = true;
    token.content = (firstLine && firstLine.trim() ? firstLine + '\n' : '')
        + state.getLines(start + 1, next, state.tShift[start], true)
        + (lastLine && lastLine.trim() ? lastLine : '');
    token.map = [start, state.line];
    token.markup = '$$';
    return true;
}
/**
 * Escapes string so it can be safely displayed in an html page.
 * @param unsafe String to escape.
 * @todo There's probably a better way to do this with a library.
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
/**
 * Plugs the maths functionality into an instance of MarkdownIt.
 * @param md Instance of MarkdownIt.
 * @param options Plugin options.
 */
function plugin(md, options) {
    // Initialise default options.
    options = Object.assign({ blockWrapper: 'div' }, options);
    /**
     * Renders inline maths using KaTeX.
     * @param tokens Array of tokens parsed from the document.
     * @param idx Index of the current token.
     */
    const renderInline = (tokens, idx, opts, env) => {
        const maths = tokens[idx].content;
        const throwOnError = typeof options.throwOnError === 'function'
            ? options.throwOnError(env)
            : !!options.throwOnError;
        try {
            const rendered = katex_1.default.renderToString(maths, Object.assign({}, options, { throwOnError, displayMode: false }));
            return `${rendered}\n`;
        }
        catch (error) {
            if (throwOnError) {
                error.diagnostics = Object.assign({}, error.diagnostics, { source: maths });
                throw error;
            }
            return `<span class="katex-error" style="color:${escapeHtml(options.errorColor)}" title="${escapeHtml(error.toString())}">${escapeHtml(maths)}</span>`;
        }
    };
    /**
     * Renders block maths using KaTeX.
     * @param tokens Array of tokens parsed from the document.
     * @param idx Index of the current token.
     */
    const renderBlock = (tokens, idx, opts, env) => {
        const maths = tokens[idx].content;
        const throwOnError = typeof options.throwOnError === 'function'
            ? options.throwOnError(env)
            : !!options.throwOnError;
        try {
            const rendered = katex_1.default.renderToString(maths, Object.assign({}, options, { throwOnError, displayMode: true }));
            return `<${options.blockWrapper} class="katex-block">\n${rendered}\n</${options.blockWrapper}>\n`;
        }
        catch (error) {
            if (throwOnError) {
                error.diagnostics = Object.assign({}, error.diagnostics, { source: maths });
                throw error;
            }
            return `<${options.blockWrapper} class="katex-block katex-error" title="${escapeHtml(error.toString())}">${escapeHtml(maths)}</${options.blockWrapper}>`;
        }
    };
    md.inline.ruler.after('escape', 'math_inline', math_inline);
    // The @types/markdown-it declaration for this is incorrect, hence the need to cast as `any`.
    md.block.ruler.after('blockquote', 'math_block', math_block, {
        alt: ['paragraph', 'reference', 'blockquote', 'list']
    });
    md.renderer.rules.math_inline = renderInline;
    md.renderer.rules.math_block = renderBlock;
}
;
exports.default = plugin;
//# sourceMappingURL=index.js.map