/** Recursively removes all readonly modifiers from the given type. */
export type Mutable<T> = {
    -readonly [P in keyof T]: Mutable<T[P]>;
};

/**
 * Specifies the name or path to a type/symbol.
 *
 * If a string is provided, then the following rules apply:
 *
 * - If the string starts with a "." or contains a "#" character, then the first
 * part of the string will be used as the module path.
 *
 * - If the strings contains a "#" character, then the second part of the string
 * will be used as the type/symbol name. If this is not specified and the string is
 * considered a module path, then the default export will be used.
 *
 * - If the string does not contain a "#" character and is not considered a module
 * path, then the string will be used as the type/symbol name.
 */
export type TypePath = string | {
    /** The path to the module, relative to the current working directory. */
    modulePath?: string;
    /** The name of the type/symbol. If not specified, the default export will be used. */
    name?: string;
}

/**
 * Helper function to derive the module path and export name (if provided) from a TypePath
 * string or object.
 */
export function normalizeTypePath(typePath: TypePath) {
    if (typeof typePath === "string") {
        // easiest case: if the string contains a "#" character, then we can just split
        // the string on the "#" character and return the result
        if (typePath.includes("#")) {
            const [modulePath, name] = typePath.split("#");
            return { modulePath, name };
        }

        // otherwise, we need to check if the string is a module path
        if (typePath.startsWith(".")) {
            return { modulePath: typePath };
        }

        // otherwise, the string is just the name of the type/symbol
        return { name: typePath };
    }

    return typePath;
}