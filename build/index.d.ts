import MarkdownIt from 'markdown-it';
/**
 * Options for the plugin.
 */
export interface Options {
    /**
     * The element with which to wrap the block-level maths.
     * @default div
     */
    blockWrapper?: string;
    /**
     * If KaTeX encounters an error, a `ParseError` is thrown.
     *
     * If `false`, this error is caught and the source maths is displayed
     * in an element with the `katex-error` class.
     *
     * If `true`, the error is rethrown.
     */
    throwOnError?: ((env: any) => boolean) | boolean;
    /**
     * A color string in hex format.
     * @example #357
     * @example #335577
     */
    errorColor?: string;
    /**
     * A collection of custom macros. The key of the object is the name of
     * the macro (including the backslash).
     */
    macros?: any;
}
/**
 * Plugs the maths functionality into an instance of MarkdownIt.
 * @param md Instance of MarkdownIt.
 * @param options Plugin options.
 */
declare function plugin(md: MarkdownIt, options: Options): void;
export default plugin;
