import { Kind } from "graphql";
import { SourceFile } from "ts-morph";
import { TypePath } from "./types";
import { normalizeTypePath } from "./types";

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
    }

    throw new Error(`Invalid type path provided: ${JSON.stringify(typePath)}`);
}