import { existsSync, statSync } from "fs";
import { readFile } from "fs/promises";
import { basename, dirname, join, relative } from "path";
import type { SourceFile } from "ts-morph";

/**
 * Renders a template into the given Typescript source file.
 */
export async function renderTemplate(
    output: SourceFile,
    template: string,
    // data: Record<string, unknown>,
) {
    const tpl = await readFile(__dirname + "/../templates/" + template + ".ts", "utf8");
    // TODO: templating
    output.addStatements(tpl);
}

/**
 * Returns true if the given value is an object literal and not null
 * or an array.
 */
export function isObject(value: unknown) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Ensures that the given value is a valid filepath that can be resolved
 * from the current working directory (or is a valid absolute path).
 */
export function isFile(filepath: string) {
    return (
        typeof filepath === "string" &&
        filepath !== "" &&
        existsSync(filepath) &&
        statSync(filepath).isFile()
    );
}
/** Displays the given text in red. */
export function red(str: string) {
    return `\x1b[31m${str}\x1b[0m`;
}

/* Converts the given value to camel case. */
export function camelCase(str: string) {
    return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
}

/* Converts the given value to pascal case. */
export function pascalCase(str: string) {
    return camelCase(str).replace(/^[a-z]/, (c) => c.toUpperCase());
}

/* Converts the given value to snake case. */
export function snakeCase(str: string) {
    return str.replace(/([A-Z])/g, (_, c) => `_${c.toLowerCase()}`);
}

/** Converts the given value to screaming snake case. */
export function screamingSnakeCase(str: string) {
    return snakeCase(str).toUpperCase();
}

/** Helper for formatting a Typescript import path. */
export function getImportPath(from: string, to: string) {
    const relativePath = relative(dirname(from), dirname(to));
    const base = basename(to, ".ts");
    const result = join(relativePath, base);
    return result.startsWith(".") ? result : "./" + result;
}

/** 
 * Formats JS code as a string similar to JSON.stringify, but supports
 * JS primitives, functions, and regular expressions.
 */
export function jsify(value: unknown): string {
    switch (typeof value) {
        case "boolean":
        case "number":
        case "bigint":
        case "string":
            return JSON.stringify(value);
        case "function":
            const fnString = value.toString();
            return !fnString.startsWith("function") && !fnString.startsWith("(")
                ? "function " + fnString.slice(fnString.indexOf("("))
                : fnString;
        case "object":
            if (value === null) {
                return "null";
            } else if (value instanceof RegExp) {
                return value.toString();
            } else if (Array.isArray(value)) {
                let output = "[\n";
                for (const item of value) {
                    output += jsify(item) + ",\n";
                }
                return output + "]";
            } else if ("$raw" in value && typeof value["$raw"] === "string") {
                return value["$raw"];
            } else {
                let output = "{\n";
                for (const [k, v] of Object.entries(value)) {
                    // does the key need to be quoted?
                    const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)
                        ? k
                        : JSON.stringify(k);

                    output += `${key}: ${jsify(v)},\n`;
                }
                return output + "}";
            }
        default:
            return "undefined";
    }
}