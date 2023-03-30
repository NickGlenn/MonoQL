import { Kind } from "graphql";
import { SourceFile } from "ts-morph";
import { TransformSchemaFn } from "./index";
import { PipelineAction } from "./runner";

export const mergableFieldsByKind: Record<string, string[]> = {
    [Kind.OBJECT_TYPE_DEFINITION]: ["fields", "interfaces", "directives"],
    [Kind.INTERFACE_TYPE_DEFINITION]: ["fields", "directives"],
    [Kind.INPUT_OBJECT_TYPE_DEFINITION]: ["fields", "directives"],
    [Kind.ENUM_TYPE_DEFINITION]: ["values", "directives"],
    [Kind.UNION_TYPE_DEFINITION]: ["types", "directives"],
    [Kind.SCALAR_TYPE_DEFINITION]: ["directives"],
    [Kind.SCHEMA_DEFINITION]: ["directives", "operationTypes"],
    [Kind.OBJECT_TYPE_EXTENSION]: ["fields", "interfaces", "directives"],
    [Kind.INTERFACE_TYPE_EXTENSION]: ["fields", "directives"],
    [Kind.INPUT_OBJECT_TYPE_EXTENSION]: ["fields", "directives"],
    [Kind.ENUM_TYPE_EXTENSION]: ["values", "directives"],
    [Kind.UNION_TYPE_EXTENSION]: ["types", "directives"],
    [Kind.SCALAR_TYPE_EXTENSION]: ["directives"],
    [Kind.SCHEMA_EXTENSION]: ["directives", "operationTypes"],
};

export const extensionToDefinition: Partial<Record<Kind, Kind>> = {
    [Kind.OBJECT_TYPE_EXTENSION]: Kind.OBJECT_TYPE_DEFINITION,
    [Kind.INTERFACE_TYPE_EXTENSION]: Kind.INTERFACE_TYPE_DEFINITION,
    [Kind.INPUT_OBJECT_TYPE_EXTENSION]: Kind.INPUT_OBJECT_TYPE_DEFINITION,
    [Kind.ENUM_TYPE_EXTENSION]: Kind.ENUM_TYPE_DEFINITION,
    [Kind.UNION_TYPE_EXTENSION]: Kind.UNION_TYPE_DEFINITION,
    [Kind.SCALAR_TYPE_EXTENSION]: Kind.SCALAR_TYPE_DEFINITION,
    [Kind.SCHEMA_EXTENSION]: Kind.SCHEMA_DEFINITION,
};

export const extTypeKinds = Object.keys(extensionToDefinition);

export const baseTypeKinds = Object.values(extensionToDefinition);


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

/**
 * Creates the TS Morph import statement and/or type alias for a TypePath.
 */
export function addTypePathImport(source: SourceFile, typePath: TypePath, asName: string, typeOnly = false) {
    const { modulePath, name } = normalizeTypePath(typePath);

    if (modulePath && name) {
        source.addImportDeclaration({
            isTypeOnly: typeOnly,
            moduleSpecifier: modulePath,
            namedImports: [{
                name,
                alias: asName,
            }],
        });
    } else if (modulePath) {
        source.addImportDeclaration({
            isTypeOnly: typeOnly,
            moduleSpecifier: modulePath,
            defaultImport: asName,
        });
    } else if (name) {
        source.addTypeAlias({
            name: asName,
            type: name,
        });
    } else {
        throw new Error(`Invalid type path provided: ${JSON.stringify(typePath)}`);
    }
}