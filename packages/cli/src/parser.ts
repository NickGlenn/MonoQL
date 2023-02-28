import { readFileSync } from "fs";
import glob from "glob";
import type { DocumentNode } from "graphql";
import { parse } from "graphql";

/**
 * Parses the GraphQL schema definitions and performs pre-processing. This is where we
 * collect custom directives and other metadata to create the internal definitions that
 * will be used for code generation.
 */
export function parseSchema(dir: string, schemaFiles: string) {
    const files = glob.sync(schemaFiles, {
        absolute: true,
        cwd: dir,
    });

    // load all the schema files and merge them into a single string
    let schema = "";

    for (const file of files) {
        schema += readFileSync(file, "utf8") + "\n";
    }

    // parse the schema
    return parse(schema) as Mutable<DocumentNode>;
}

// recursively removes all readonly modifiers from the given type
export type Mutable<T> = {
    -readonly [P in keyof T]: Mutable<T[P]>;
};