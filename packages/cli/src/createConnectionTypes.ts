import type { DocumentNode, ObjectTypeDefinitionNode, NamedTypeNode } from "graphql";
import { Kind } from "graphql";
import type { Config } from "./config";
import type { Mutable } from "./parser";

/**
 * Generates missing Relay-style connection types for all fields that use a @connection
 * directive. The @connection directive requires requires a "for" argument that contains
 * a string with the name of another type in the schema. This function will generate
 * a connection type for that type.
 *
 * If an "Edge" type is defined and set as the "via" argument of the @connection directive,
 * then the generated connection type will use that type to populate the "edges" field.
 *
 * The "PageInfo" type will also be created automatically if missing.
 *
 * Additionally, the "config.connectionArgs" provides a list of arguments that will be
 * added to the connection field (if missing). By default, the "first" and "after" arguments
 * are added.
 */
export function createConnectionTypes(ast: Mutable<DocumentNode>, config: Config) {
    let pageType: undefined | Mutable<ObjectTypeDefinitionNode>;

    // TODO: get these from the config
    const addFirstArg = true;
    const addAfterArg = true;
    const addLastArg = false;
    const addBeforeArg = false;
    const addTotalCountToPageInfo = false;


    // iterate over all definitions in the schema
    for (const definition of ast.definitions) {
        // we only care about object types
        if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION) {
            continue;
        }

        // is this the "PageInfo" type?
        if (definition.name.value === "PageInfo") {
            pageType = definition;
            continue;
        }

        // iterate over all fields in the object type
        for (const field of definition.fields || []) {
            field.directives = field.directives || [];

            // find the @connection directive
            const connectionDirectiveIndex = field.directives.findIndex(d => d.name.value === "connection");
            if (connectionDirectiveIndex === -1) {
                continue;
            }

            const connectionDirective = field.directives[connectionDirectiveIndex];

            // find the "for" argument
            const forArg = connectionDirective.arguments?.find(a => a.name.value === "for");
            if (!forArg || forArg.value.kind !== Kind.STRING) {
                throw new Error(`The @connection directive on field "${definition.name.value}.${field.name.value}" is missing the "for" argument.`);
            }

            // find the type that the connection is for
            const forTypeStr = forArg.value.value;
            const forType = ast.definitions.find(d => d.kind === Kind.OBJECT_TYPE_DEFINITION && d.name.value === forTypeStr) as Mutable<ObjectTypeDefinitionNode>;
            if (!forType) {
                throw new Error(`The @connection directive on field "${definition.name.value}.${field.name.value}" specifies a "for" argument of "${forTypeStr}", but no type with that name exists.`);
            }

            // find the "via" argument
            const viaArg = connectionDirective.arguments?.find(a => a.name.value === "via");
            if (viaArg) {
                // TODO: find the "Edge" type and use it to populate the "edges" field
            }

            // does the return type end with "Connection"?
            if (field.type.kind !== Kind.NAMED_TYPE || !field.type.name.value.endsWith("Connection")) {
                throw new Error(`The return type of field "${definition.name.value}.${field.name.value}" must end with "Connection".`);
            }

            // does the returned Connection type already exist? if not, create it
            let connectionType = ast.definitions.find(d => d.kind === Kind.OBJECT_TYPE_DEFINITION && d.name.value === (field.type as NamedTypeNode).name.value) as Mutable<ObjectTypeDefinitionNode>;
            if (!connectionType) {
                connectionType = {
                    description: { kind: Kind.STRING, value: `A connection to a list of \`${forTypeStr}\` items.` },
                    kind: Kind.OBJECT_TYPE_DEFINITION,
                    name: {
                        kind: Kind.NAME,
                        value: (field.type as NamedTypeNode).name.value,
                    },
                };
                ast.definitions.push(connectionType);
            }

            // add any missing fields to the Connection type
            connectionType.fields = connectionType.fields || [];
            // TODO: add the "edges" field

            // add the "totalCount" field if the user has specified it in the config
            if (addTotalCountToPageInfo && !connectionType.fields.some(f => f.name.value === "totalCount")) {
                connectionType.fields.push({
                    description: { kind: Kind.STRING, value: "A count of the total number of objects in this connection, ignoring pagination." },
                    kind: Kind.FIELD_DEFINITION,
                    name: { kind: Kind.NAME, value: "totalCount" },
                    type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "Int" } }
                });
            }

            // add the nodes field to the connection
            if (!connectionType.fields.some(f => f.name.value === "nodes")) {
                connectionType.fields.push({
                    description: { kind: Kind.STRING, value: `A list of \`${forTypeStr}\` objects.` },
                    kind: Kind.FIELD_DEFINITION,
                    name: { kind: Kind.NAME, value: "nodes" },
                    type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.LIST_TYPE, type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: forTypeStr } } } } }
                });
            }

            // add the "pageInfo" field to the connection
            if (!connectionType.fields.some(f => f.name.value === "pageInfo")) {
                connectionType.fields.push({
                    description: { kind: Kind.STRING, value: "Information to aid in pagination." },
                    kind: Kind.FIELD_DEFINITION,
                    name: { kind: Kind.NAME, value: "pageInfo" },
                    type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "PageInfo" } } },
                });
            }

            field.arguments = field.arguments || [];

            // does the connection type already have the "first" and "after" arguments?
            if (addFirstArg && !field.arguments.some(f => f.name.value === "first")) {
                field.arguments.push({
                    description: { kind: Kind.STRING, value: "Returns the first _n_ elements from the list." },
                    kind: Kind.INPUT_VALUE_DEFINITION,
                    name: { kind: Kind.NAME, value: "first" },
                    type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "Int" } }
                });
            }

            if (addAfterArg && !field.arguments.some(f => f.name.value === "after")) {
                field.arguments.push({
                    description: { kind: Kind.STRING, value: "Returns the elements in the list that come after the specified cursor." },
                    kind: Kind.INPUT_VALUE_DEFINITION,
                    name: { kind: Kind.NAME, value: "after" },
                    type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "String" } }
                });
            }

            if (addLastArg && !field.arguments.some(f => f.name.value === "last")) {
                field.arguments.push({
                    description: { kind: Kind.STRING, value: "Returns the last _n_ elements from the list." },
                    kind: Kind.INPUT_VALUE_DEFINITION,
                    name: { kind: Kind.NAME, value: "last" },
                    type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "Int" } }
                });
            }

            if (addBeforeArg && !field.arguments.some(f => f.name.value === "before")) {
                field.arguments.push({
                    description: { kind: Kind.STRING, value: "Returns the elements in the list that come before the specified cursor." },
                    kind: Kind.INPUT_VALUE_DEFINITION,
                    name: { kind: Kind.NAME, value: "before" },
                    type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "String" } }
                });
            }

            // remove the @connection directive
            field.directives.splice(connectionDirectiveIndex, 1);
        }
    }



    // if the "PageInfo" type is missing, create it
    if (!pageType) {
        pageType = {
            kind: Kind.OBJECT_TYPE_DEFINITION,
            name: {
                kind: Kind.NAME,
                value: "PageInfo"
            },
        };
        ast.definitions.push(pageType);
    }

    // add any missing fields to the "PageInfo" type
    pageType.fields = pageType.fields || [];
    if (!pageType.fields.some(f => f.name.value === "hasNextPage")) {
        pageType.fields.push({
            description: { kind: Kind.STRING, value: "When paginating forwards, are there more items?" },
            kind: Kind.FIELD_DEFINITION,
            name: { kind: Kind.NAME, value: "hasNextPage" },
            type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "Boolean" } } },
        });
    }

    if (!pageType.fields.some(f => f.name.value === "hasPreviousPage")) {
        pageType.fields.push({
            description: { kind: Kind.STRING, value: "When paginating backwards, are there more items?" },
            kind: Kind.FIELD_DEFINITION,
            name: { kind: Kind.NAME, value: "hasPreviousPage" },
            type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "Boolean" } } },
        });
    }

    if (!pageType.fields.some(f => f.name.value === "startCursor")) {
        pageType.fields.push({
            description: { kind: Kind.STRING, value: "When paginating backwards, the cursor to continue." },
            kind: Kind.FIELD_DEFINITION,
            name: { kind: Kind.NAME, value: "startCursor" },
            type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "String" } }
        });
    }

    if (!pageType.fields.some(f => f.name.value === "endCursor")) {
        pageType.fields.push({
            description: { kind: Kind.STRING, value: "When paginating forwards, the cursor to continue." },
            kind: Kind.FIELD_DEFINITION,
            name: { kind: Kind.NAME, value: "endCursor" },
            type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "String" } }
        });
    }
}