import { DefinitionNode, DocumentNode, InterfaceTypeDefinitionNode, Kind } from "graphql";
import { Observable } from "rxjs";
import type { Mutable } from "./parser";


const mergableFieldsByKind: Record<string, string[]> = {
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

const extensionToDefinition: Partial<Record<Kind, Kind>> = {
    [Kind.OBJECT_TYPE_EXTENSION]: Kind.OBJECT_TYPE_DEFINITION,
    [Kind.INTERFACE_TYPE_EXTENSION]: Kind.INTERFACE_TYPE_DEFINITION,
    [Kind.INPUT_OBJECT_TYPE_EXTENSION]: Kind.INPUT_OBJECT_TYPE_DEFINITION,
    [Kind.ENUM_TYPE_EXTENSION]: Kind.ENUM_TYPE_DEFINITION,
    [Kind.UNION_TYPE_EXTENSION]: Kind.UNION_TYPE_DEFINITION,
    [Kind.SCALAR_TYPE_EXTENSION]: Kind.SCALAR_TYPE_DEFINITION,
    [Kind.SCHEMA_EXTENSION]: Kind.SCHEMA_DEFINITION,
};

const extTypeKinds = Object.keys(extensionToDefinition);
const baseTypeKinds = Object.values(extensionToDefinition);


function printDefinitions(ast: Mutable<DocumentNode>) {
    console.table(ast.definitions.map((def) => ({
        kind: def.kind,
        name: (def as any).name?.value ?? "",
    })));
}


/**
 * Implements missing types based on any objects that use the "extend" keyword.
 */
export function implementMissingBaseDeclarations(ast: Mutable<DocumentNode>) {
    return new Observable(observer => {

        const seenTypeAndKinds: Record<string, Kind> = {};
        let schemaBaseSeen = false

        for (const definition of ast.definitions) {
            if (definition.kind === Kind.SCHEMA_DEFINITION) {
                observer.next("Found schema definition");
                schemaBaseSeen = true;
            }
            else if (definition.kind === Kind.OBJECT_TYPE_DEFINITION
                || definition.kind === Kind.INTERFACE_TYPE_DEFINITION
                || definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
                || definition.kind === Kind.ENUM_TYPE_DEFINITION
                || definition.kind === Kind.UNION_TYPE_DEFINITION
            ) {
                observer.next(`Found base type "${definition.name.value}"`);
                seenTypeAndKinds[definition.name.value] = definition.kind;
            }
        }

        for (let i = ast.definitions.length - 1; i >= 0; i--) {
            const definition = ast.definitions[i];

            // schema extensions are special case (they don't have a name)
            if (definition.kind === Kind.SCHEMA_EXTENSION) {
                if (!schemaBaseSeen) {
                    observer.next("Adding missing schema base definition");
                    ast.definitions.push({
                        kind: Kind.SCHEMA_DEFINITION,
                        directives: [],
                        operationTypes: [],
                    });
                    schemaBaseSeen = true;
                }
                continue;
            }

            // otherwise, just look for the other extension types
            if (
                definition.kind === Kind.OBJECT_TYPE_EXTENSION
                || definition.kind === Kind.INTERFACE_TYPE_EXTENSION
                || definition.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION
                || definition.kind === Kind.ENUM_TYPE_EXTENSION
                || definition.kind === Kind.UNION_TYPE_EXTENSION
            ) {
                const expectedBaseKind = extensionToDefinition[definition.kind];
                if (!expectedBaseKind) throw new Error(`Unknown extension type "${definition.kind}"`);

                const name = definition.name.value;
                const seenKind = seenTypeAndKinds[name];

                if (seenKind === expectedBaseKind) {
                    continue;
                }

                if (seenKind && seenKind !== expectedBaseKind) {
                    throw new Error(`Duplicate definition for type "${name}" of different kind.`);
                }

                observer.next(`Adding missing base definition for "${name}"`);
                seenTypeAndKinds[name] = expectedBaseKind;
                ast.definitions.push({
                    kind: expectedBaseKind,
                    name: { kind: Kind.NAME, value: name },
                } as Mutable<DefinitionNode>);
            }
        }

        // printDefinitions(ast);

        observer.complete();
    });
}

/**
 * Flattens extension types into their base types. Throws an error on any duplicate fields
 * of the same name but different types.
 */
export function flattenExtensionTypes(ast: Mutable<DocumentNode>) {
    type NodeIsh = { kind: Kind, name: { value: string } } & Record<string, any[]>;

    const baseTypes: Record<string, NodeIsh> = {};

    // find all the base types
    for (const definition of ast.definitions) {
        if (baseTypeKinds.includes(definition.kind) && "name" in definition) {
            baseTypes[(definition as unknown as NodeIsh).name.value] = definition as unknown as NodeIsh;
        }
    }

    // find all the extensions and merge them into the base types
    for (let i = ast.definitions.length - 1; i >= 0; i--) {
        const extType: NodeIsh = ast.definitions[i] as any;
        const baseType = baseTypes[extType.name.value];

        if (!extensionToDefinition[extType.kind]) {
            continue;
        }

        if (!baseType) {
            throw new Error(`Cannot extend type "${extType.name.value}" because it does not exist.`);
        }

        if (baseType.kind !== extensionToDefinition[extType.kind]) {
            throw new Error(`Cannot extend type "${extType.name.value}" because it is not the same kind.`);
        }

        for (const field of mergableFieldsByKind[extType.kind]) {
            if (!extType[field]) {
                continue;
            }

            baseType[field] = baseType[field] || [];

            for (const ext of extType[field]) {
                const existing = baseType[field].find(f => f.name.value === ext.name.value);
                if (existing) {
                    if (
                        existing.type.kind !== ext.type.kind ||
                        (existing.type.kind === Kind.NAMED_TYPE &&
                            existing.type.name.value !== ext.type.name.value)
                    ) {
                        throw new Error(`Cannot extend type "${(extType as any).name.value}" because it has a duplicate field "${ext.name.value}" with a different type.`);
                    }
                } else {
                    baseType[field].push(ext);
                }
            }
        }

        // remove the extension
        ast.definitions.splice(i, 1);
    }
}


// /**
//  * Flattens all interfaces and their extensions into a single object. Unlike standard
//  * GraphQL, this will not throw an error if the interface type does not exist.
//  */
// export function flattenInterfaceExtensions(ast: Mutable<DocumentNode>) {
//     const interfaceTypeResult: Record<string, Mutable<InterfaceTypeDefinitionNode>> = {};
//     const interfaceTypeExtension: Record<string, Mutable<InterfaceTypeExtensionNode>> = {};

//     for (let i = ast.definitions.length - 1; i >= 0; i--) {
//         const definition = ast.definitions[i];
//         switch (definition.kind) {
//             case Kind.INTERFACE_TYPE_DEFINITION:
//                 interfaceTypeResult[definition.name.value] = definition;
//                 break;
//             case Kind.INTERFACE_TYPE_EXTENSION:
//                 interfaceTypeExtension[definition.name.value] = definition;
//                 ast.definitions.splice(i, 1);
//                 break;
//         }
//     }

//     for (const extOf in interfaceTypeExtension) {
//         const ext = interfaceTypeExtension[extOf];
//         let iface = interfaceTypeResult[extOf];

//         // if the interface type does not exist, then we will create it
//         if (!iface) {
//             interfaceTypeResult[extOf] = {
//                 kind: Kind.INTERFACE_TYPE_DEFINITION,
//                 name: ext.name,
//                 fields: [],
//                 directives: [],
//             };
//             iface = interfaceTypeResult[extOf];
//             ast.definitions.push(iface);
//         }

//         iface.fields = iface.fields || [];
//         iface.directives = iface.directives || [];

//         // merge the fields
//         if (ext.fields) {
//             for (const field of ext.fields) {
//                 iface.fields.push(field);
//             }
//         }

//         // merge directives
//         if (ext.directives) {
//             for (const directive of ext.directives) {
//                 iface.directives.push(directive);
//             }
//         }

//         // TODO: merge inherited interfaces
//     }
// }

// /**
//  * Flattens all object types and their extensions into a single object. Unlike standard
//  * GraphQL, this will not throw an error if the object type does not exist.
//  */
// export function flattenObjectTypeExtensions(ast: Mutable<DocumentNode>) {
//     const objectTypeResult: Record<string, Mutable<ObjectTypeDefinitionNode>> = {};
//     const objectTypeExtension: Record<string, Mutable<ObjectTypeExtensionNode>> = {};

//     for (let i = ast.definitions.length - 1; i >= 0; i--) {
//         const definition = ast.definitions[i];
//         switch (definition.kind) {
//             case Kind.OBJECT_TYPE_DEFINITION:
//                 objectTypeResult[definition.name.value] = definition;
//                 break;
//             case Kind.OBJECT_TYPE_EXTENSION:
//                 objectTypeExtension[definition.name.value] = definition;
//                 ast.definitions.splice(i, 1);
//                 break;
//         }
//     }

//     for (const extOf in objectTypeExtension) {
//         const ext = objectTypeExtension[extOf];
//         let obj = objectTypeResult[extOf];

//         // if the object type does not exist, then we will create it
//         if (!obj) {
//             objectTypeResult[extOf] = {
//                 kind: Kind.OBJECT_TYPE_DEFINITION,
//                 name: ext.name,
//                 fields: [],
//                 interfaces: [],
//                 directives: [],
//             };
//             obj = objectTypeResult[extOf];
//             ast.definitions.push(obj);
//         }

//         obj.fields = obj.fields || [];
//         obj.directives = obj.directives || [];
//         obj.interfaces = obj.interfaces || [];

//         // merge the fields
//         if (ext.fields) {
//             for (const field of ext.fields) {
//                 obj.fields.push(field);
//             }
//         }

//         // merge directives
//         if (ext.directives) {
//             for (const directive of ext.directives) {
//                 obj.directives.push(directive);
//             }
//         }

//         // merge interfaces
//         if (ext.interfaces) {
//             for (const iface of ext.interfaces) {
//                 obj.interfaces.push(iface);
//             }
//         }
//     }
// }

/**
 * Finds all object type definitions that implement an interface and automatically implements
 * the interface's fields on the object type if not explicitly defined.
 */
export function implementMissingInterfaceFields(ast: Mutable<DocumentNode>) {
    const interfaceMap: Record<string, Mutable<InterfaceTypeDefinitionNode>> = {};

    // first, we will build a map of all interfaces
    for (const definition of ast.definitions) {
        if (definition.kind === Kind.INTERFACE_TYPE_DEFINITION) {
            interfaceMap[definition.name.value] = definition;
        }
    }

    // now process all object types and iterate through their interfaces
    for (const definition of ast.definitions) {
        // skip non-object types
        if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION) {
            continue;
        }

        // skip if the object type does not implement any interfaces
        if (!definition.interfaces || definition.interfaces.length === 0) {
            continue;
        }

        // iterate through all interfaces and implement their fields
        for (const iface of definition.interfaces) {
            const interfaceDefinition = interfaceMap[iface.name.value];
            if (!interfaceDefinition) {
                console.warn(`Interface ${iface.name.value} does not exist.`);
                continue;
            }

            // ensure the object type has a fields array
            definition.fields = definition.fields || [];

            // iterate through all fields and add them if they do not already exist
            for (const field of interfaceDefinition?.fields || []) {
                if (!definition.fields.find((f) => f.name.value === field.name.value)) {
                    definition.fields.push(field);
                }
            }
        }
    }
}