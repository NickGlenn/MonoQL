import type { Plugin } from "rollup";

/**
 * Provides a Rollup adapter to automatically rebuild your MonoQL backend
 * when your schema configuration changes.
 */
export function monoql(): Plugin {
    return {
        name: "monoql",
        buildStart() { },
        buildEnd() { },
    };
}