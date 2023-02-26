import { DocumentNode, Kind, ObjectTypeDefinitionNode, ObjectTypeExtensionNode } from "graphql";
import type { Mutable } from "./parser";

/**
 * Performs some general pre-processing on the AST. This is to make the AST easier
 * to work with when generating the Typescript code.
 */
export function preprocessAstForGeneration(ast: Mutable<DocumentNode>) {
    flattenObjectTypeExtensions(ast);
}

/**
 * Flattens all types and their extensions into a single object. Unlike standard
 * GraphQL, this will not throw an error if the object type does not exist.
 */
function flattenObjectTypeExtensions(ast: Mutable<DocumentNode>) {
    const objectTypeResult: Record<string, Mutable<ObjectTypeDefinitionNode>> = {};
    const objectTypeExtension: Record<string, Mutable<ObjectTypeExtensionNode>> = {};

    for (let i = ast.definitions.length - 1; i >= 0; i--) {
        const definition = ast.definitions[i];
        switch (definition.kind) {
            case Kind.OBJECT_TYPE_DEFINITION:
                objectTypeResult[definition.name.value] = definition;
                break;
            case Kind.OBJECT_TYPE_EXTENSION:
                objectTypeExtension[definition.name.value] = definition;
                ast.definitions.splice(i, 1);
                break;
        }
    }

    for (const extOf in objectTypeExtension) {
        const ext = objectTypeExtension[extOf];
        let obj = objectTypeResult[extOf];

        // if the object type does not exist, then we will create it
        if (!obj) {
            objectTypeResult[extOf] = {
                kind: Kind.OBJECT_TYPE_DEFINITION,
                name: ext.name,
                fields: ext.fields,
                interfaces: ext.interfaces,
                directives: ext.directives,
                loc: ext.loc,
            };
            obj = objectTypeResult[extOf];
            ast.definitions.push(obj);
        }

        obj.fields = obj.fields || [];
        obj.directives = obj.directives || [];
        obj.interfaces = obj.interfaces || [];

        // merge the fields
        if (ext.fields) {
            for (const field of ext.fields) {
                obj.fields.push(field);
            }
        }

        // merge directives
        if (ext.directives) {
            for (const directive of ext.directives) {
                obj.directives.push(directive);
            }
        }

        // merge interfaces
        if (ext.interfaces) {
            for (const iface of ext.interfaces) {
                obj.interfaces.push(iface);
            }
        }
    }
}
