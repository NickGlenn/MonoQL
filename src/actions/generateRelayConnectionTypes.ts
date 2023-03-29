import { ObjectTypeDefinitionNode, NamedTypeNode, FieldDefinitionNode, DocumentNode, visit } from "graphql";
import { Kind } from "graphql";
import { PipelineAction } from "../core";
import { Mutable } from "../types";
import { ensureActionIsUnique, getDirectives } from "../utils";

export interface GenerateRelayConnectionTypesOptions {
    /**
     * Determines what arguments will be added to the connection field if missing.
     * By default, the "first" and "after" arguments are added.
     */
    pageArgs?: {
        /** Adds the "first" argument to the connection field. */
        first?: boolean;
        /** Adds the "after" argument to the connection field. */
        after?: boolean;
        /** Adds the "last" argument to the connection field. */
        last?: boolean;
        /** Adds the "before" argument to the connection field. */
        before?: boolean;
    };
    /**
     * When true, a `totalCount` field will be added to connection types if missing.
     */
    addTotalCountToConnectionTypes?: boolean;
    /**
     * When set, the Relay page info type and fields will be added to the
     * schema if missing.
     */
    pageInfo?: {
        /** The name of the page info type. Defaults to "PageInfo". */
        typeName?: string;
        /** When true (default), the "hasNextPage" field will be added to the page info type. */
        hasNextPage?: boolean;
        /** When true (default), the "hasPreviousPage" field will be added to the page info type. */
        hasPreviousPage?: boolean;
        /** When true (default), the "startCursor" field will be added to the page info type. */
        startCursor?: boolean;
        /** When true (default), the "endCursor" field will be added to the page info type. */
        endCursor?: boolean;
    };
}

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
export function generateRelayConnectionTypes({
    pageArgs = { first: true, after: true },
    addTotalCountToConnectionTypes = false,
    pageInfo = {
        typeName: "PageInfo",
        hasNextPage: true,
        hasPreviousPage: true,
        startCursor: true,
        endCursor: true,
    },
}: GenerateRelayConnectionTypesOptions = {}): PipelineAction {
    return {
        name: "Generate Relay Connection Types",
        validate(ctx) {
            ensureActionIsUnique(ctx);
        },
        execute(ctx) {
            const ast = ctx.ast as Mutable<DocumentNode>;

            const pageInfoTypeName = pageInfo.typeName ?? "PageInfo";
            {
                const pageInfoHasNextPage = pageInfo.hasNextPage ?? true;
                const pageInfoHasPreviousPage = pageInfo.hasPreviousPage ?? true;
                const pageInfoStartCursor = pageInfo.startCursor ?? true;
                const pageInfoEndCursor = pageInfo.endCursor ?? true;

                // find the "PageInfo" type
                let pageInfoType = ast.definitions.find(d => d.kind === Kind.OBJECT_TYPE_DEFINITION && d.name.value === pageInfoTypeName) as Mutable<ObjectTypeDefinitionNode>;
                if (!pageInfoType) {
                    pageInfoType = {
                        kind: Kind.OBJECT_TYPE_DEFINITION,
                        name: {
                            kind: Kind.NAME,
                            value: pageInfoTypeName,
                        },
                        fields: [],
                    };
                    ast.definitions.push(pageInfoType);
                }

                pageInfoType.fields = pageInfoType.fields || [];

                // add the "hasNextPage" field
                if (pageInfoHasNextPage && !pageInfoType.fields.find(f => f.name.value === "hasNextPage")) {
                    pageInfoType.fields.push({
                        description: { kind: Kind.STRING, value: "When paginating forwards, are there more items?" },
                        kind: Kind.FIELD_DEFINITION,
                        name: { kind: Kind.NAME, value: "hasNextPage" },
                        type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "Boolean" } } },
                    });
                }

                // add the "hasPreviousPage" field
                if (pageInfoHasPreviousPage && !pageInfoType.fields.find(f => f.name.value === "hasPreviousPage")) {
                    pageInfoType.fields.push({
                        description: { kind: Kind.STRING, value: "When paginating backwards, are there more items?" },
                        kind: Kind.FIELD_DEFINITION,
                        name: { kind: Kind.NAME, value: "hasPreviousPage" },
                        type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "Boolean" } } },
                    });
                }

                // add the "startCursor" field
                if (pageInfoStartCursor && !pageInfoType.fields.find(f => f.name.value === "startCursor")) {
                    pageInfoType.fields.push({
                        description: { kind: Kind.STRING, value: "When paginating backwards, the cursor to continue." },
                        kind: Kind.FIELD_DEFINITION,
                        name: { kind: Kind.NAME, value: "startCursor" },
                        type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "String" } },
                    });
                }

                // add the "endCursor" field
                if (pageInfoEndCursor && !pageInfoType.fields.find(f => f.name.value === "endCursor")) {
                    pageInfoType.fields.push({
                        description: { kind: Kind.STRING, value: "When paginating forwards, the cursor to continue." },
                        kind: Kind.FIELD_DEFINITION,
                        name: { kind: Kind.NAME, value: "endCursor" },
                        type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "String" } },
                    });
                }
            }

            const addFirstArg = pageArgs.first ?? true;
            const addAfterArg = pageArgs.after ?? true;
            const addLastArg = pageArgs.last ?? false;
            const addBeforeArg = pageArgs.before ?? false;

            const seenConnectionTypes: { [key: string]: boolean } = {};

            ctx.ast = visit(ctx.ast, {
                Directive(node, key, parent, path, ancestors) {
                    if (node.name.value !== "connection") return;

                    const parentField = ancestors[ancestors.length - 1] as Mutable<FieldDefinitionNode>;

                    // skip if we don't have the correct parent type
                    if (!parentField || parentField.kind !== Kind.FIELD_DEFINITION) {
                        return;
                    }

                    // get the name of parent field
                    const fieldName = parentField.name.value;

                    // find the "for" argument
                    const forArg = node.arguments?.find(a => a.name.value === "for");
                    if (!forArg || forArg.value.kind !== Kind.STRING) {
                        throw new Error(`The @connection directive on field "${fieldName}" is missing the "for" argument.`);
                    }

                    // find the type that the connection is for - this will be the return type of the
                    // field that the @connection directive is on
                    const returnType = parentField.type;

                    // if the return type is nullable or does not end in "Connection", we should throw an error
                    if (returnType.kind !== Kind.NON_NULL_TYPE || returnType.type.kind !== Kind.NAMED_TYPE || !returnType.type.name.value.endsWith("Connection")) {
                        throw new Error(`The @connection directive on field "${fieldName}" must return a non-nullable type that ends with "Connection".`);
                    }

                    const connectionTypeName = returnType.type.name.value;

                    // find the type that the connection is for
                    const forTypeStr = forArg.value.value;
                    const forType = ast.definitions.find(d => d.kind === Kind.OBJECT_TYPE_DEFINITION && d.name.value === forTypeStr) as Mutable<ObjectTypeDefinitionNode>;

                    // if the type that the connection is for does not exist, we should throw an error
                    if (!forType) {
                        throw new Error(`The @connection directive on field "${fieldName}" is for type "${forTypeStr}" which does not exist.`);
                    }

                    // find the "via" argument that optionally specifies an edge type
                    const viaArg = node.arguments?.find(a => a.name.value === "via");
                    const viaTypeStr = viaArg?.value.kind === Kind.STRING ? viaArg.value.value : null;
                    const viaType = viaTypeStr ? ast.definitions.find(d => d.kind === Kind.OBJECT_TYPE_DEFINITION && d.name.value === viaTypeStr) as Mutable<ObjectTypeDefinitionNode> : null;

                    // if the edge type that the connection is via does not exist, we should throw an error
                    if (viaTypeStr && !viaType) {
                        throw new Error(`The @connection directive on field "${fieldName}" is via edge type "${viaTypeStr}" which does not exist.`);
                    }

                    parentField.arguments = parentField.arguments || [];

                    // add missing arguments to the parent field
                    if (addFirstArg && !parentField.arguments.find(a => a.name.value === "first")) {
                        parentField.arguments.push({
                            description: { kind: Kind.STRING, value: "Returns the first n elements from the list." },
                            kind: Kind.INPUT_VALUE_DEFINITION,
                            name: { kind: Kind.NAME, value: "first" },
                            type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "Int" } },
                        });
                    }

                    if (addAfterArg && !parentField.arguments.find(a => a.name.value === "after")) {
                        parentField.arguments.push({
                            description: { kind: Kind.STRING, value: "Returns the elements in the list that come after the specified cursor." },
                            kind: Kind.INPUT_VALUE_DEFINITION,
                            name: { kind: Kind.NAME, value: "after" },
                            type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "String" } },
                        });
                    }

                    if (addLastArg && !parentField.arguments.find(a => a.name.value === "last")) {
                        parentField.arguments.push({
                            description: { kind: Kind.STRING, value: "Returns the last n elements from the list." },
                            kind: Kind.INPUT_VALUE_DEFINITION,
                            name: { kind: Kind.NAME, value: "last" },
                            type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "Int" } },
                        });
                    }

                    if (addBeforeArg && !parentField.arguments.find(a => a.name.value === "before")) {
                        parentField.arguments.push({
                            description: { kind: Kind.STRING, value: "Returns the elements in the list that come before the specified cursor." },
                            kind: Kind.INPUT_VALUE_DEFINITION,
                            name: { kind: Kind.NAME, value: "before" },
                            type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "String" } },
                        });
                    }

                    if (!seenConnectionTypes[connectionTypeName]) {

                        seenConnectionTypes[connectionTypeName] = true;

                        // try to find the connection type being returned by the field - if we can't find it,
                        // then we'll create it
                        let connectionType = ast.definitions.find(d => d.kind === Kind.OBJECT_TYPE_DEFINITION && d.name.value === connectionTypeName) as Mutable<ObjectTypeDefinitionNode>;
                        if (!connectionType) {
                            connectionType = {
                                description: { kind: Kind.STRING, value: `A connection to a list of \`${forType.name.value}\` values.` },
                                kind: Kind.OBJECT_TYPE_DEFINITION,
                                name: { kind: Kind.NAME, value: connectionTypeName },
                                fields: [],
                            };
                            // this is super cheaty
                            ast.definitions.push(connectionType);
                        }

                        connectionType.fields = connectionType.fields || [];

                        // add any missing fields to the connection type
                        if (viaType && !connectionType.fields.find(f => f.name.value === "edges")) {
                            connectionType.fields.push({
                                description: { kind: Kind.STRING, value: "A list of edges." },
                                kind: Kind.FIELD_DEFINITION,
                                name: { kind: Kind.NAME, value: "edges" },
                                type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.LIST_TYPE, type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: viaType.name.value } } } } },
                            });
                        }

                        if (!connectionType.fields.find(f => f.name.value === "nodes")) {
                            connectionType.fields.push({
                                description: { kind: Kind.STRING, value: "A list of nodes." },
                                kind: Kind.FIELD_DEFINITION,
                                name: { kind: Kind.NAME, value: "nodes" },
                                type: {
                                    kind: Kind.NON_NULL_TYPE, type: { kind: Kind.LIST_TYPE, type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: forType.name.value } } } }
                                },
                            });
                        }

                        if (!connectionType.fields.find(f => f.name.value === "pageInfo")) {
                            connectionType.fields.push({
                                description: { kind: Kind.STRING, value: "Information to aid in pagination." },
                                kind: Kind.FIELD_DEFINITION,
                                name: { kind: Kind.NAME, value: "pageInfo" },
                                type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: pageInfoTypeName } } },
                            });
                        }

                        if (addTotalCountToConnectionTypes && !connectionType.fields.find(f => f.name.value === "totalCount")) {
                            connectionType.fields.push({
                                description: { kind: Kind.STRING, value: "The total count of nodes in this connection, ignoring pagination." },
                                kind: Kind.FIELD_DEFINITION,
                                name: { kind: Kind.NAME, value: "totalCount" },
                                type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "Int" } } },
                            });
                        }
                    }

                    // strip the @connection directive
                    return null;
                },
            });

        },
    };
}
