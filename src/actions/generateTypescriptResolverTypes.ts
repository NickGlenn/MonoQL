import { type TypeNode, Kind, StringValueNode, visit, EnumTypeDefinitionNode, EnumTypeExtensionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode, InputObjectTypeDefinitionNode, InputObjectTypeExtensionNode, InterfaceTypeDefinitionNode, InterfaceTypeExtensionNode } from "graphql";
import { Project } from "ts-morph";
import type { PipelineAction } from "../core";
import { addTypePathImport } from "../internal";
import type { TypePath } from "../types";

const BUILTIN_SCALARS: Record<string, string> = {
    String: "string",
    Int: "number",
    Float: "number",
    Boolean: "boolean",
    ID: "string",
}

export interface CreateResolverTypesOptions {
    /** Where to output the generated resolver types. */
    path: string;
    /** A map of specific Typescript types to use for GraphQL counterparts. */
    mapTypes?: Record<string, TypePath>;
    /** Provides the type to use for the context object. */
    contextType?: TypePath;
    /** When true, the @ts directive will be stripped from the schema. */
    stripTsDirective?: boolean;
    /** Default type to use for scalars (defaults to `string`). */
    defaultScalarType?: TypePath;
}

/**
 * Generates the server-side resolver types for all GraphQL types in the schema.
 */
export function generateTypescriptResolverTypes({
    path,
    mapTypes = {},
    contextType,
    stripTsDirective = true,
    defaultScalarType = "string",
}: CreateResolverTypesOptions): PipelineAction {

    // merge the builtin scalars with the user-provided scalars
    const _customTsTypes: Record<string, TypePath> = { ...BUILTIN_SCALARS, ...mapTypes };

    return {
        name: "Create Resolver Types",
        validate(ctx) {
        },
        async execute(ctx) {
            const project = new Project();



            // (re)create the resolver types file
            const resolverTypesFile = project.createSourceFile(path, "", { overwrite: true });

            resolverTypesFile.addImportDeclaration({
                moduleSpecifier: "graphql",
                isTypeOnly: true,
                namedImports: [
                    { name: "GraphQLResolveInfo" },
                    { name: "GraphQLScalarType" },
                    { name: "GraphQLScalarTypeConfig" },
                ],
            });

            if (contextType) {
                addTypePathImport(resolverTypesFile, contextType, "Ctx", true);
            } else {
                resolverTypesFile.addTypeAlias({
                    name: "Ctx",
                    type: "{}",
                });
            }

            resolverTypesFile.addTypeAlias({ name: "Maybe<T>", type: "T | null" });
            resolverTypesFile.addTypeAlias({ name: "ResolverFn<S, A, R>", type: "(source: S, args: A, context: Ctx) => R | Promise<R>" });

            // let's find, register, and strip out any @ts directives
            ctx.ast = visit(ctx.ast, {
                Directive(node, key, parent, path, ancestors) {
                    if (node.name.value === "ts") {
                        if (parent && "name" in parent) {
                            if (!parent.name) throw new Error("Expected parent to have a name.");
                            const name = parent.name.value;
                            const type = (node.arguments?.find(arg => arg.name.value === "type" && arg.value.kind === Kind.STRING)?.value as StringValueNode).value;
                            if (!type) {
                                throw new Error(`@ts(type: string) directive must specify a string "type" argument on scalar "${name}"`);
                            }

                            // existing types take precedence
                            if (!_customTsTypes[name]) {
                                _customTsTypes[name] = type;
                            }
                        }

                        return stripTsDirective ? null : node;
                    }

                    return node;
                },
            });


            const _createTsType: Record<string, boolean> = {};

            // create the root resolver type
            const rootResolverType = resolverTypesFile.addInterface({
                name: "Resolver",
                isExported: true,
                properties: [],
            });

            function _createEnum(node: EnumTypeDefinitionNode | EnumTypeExtensionNode) {
                const name = node.name.value;
                if (!_createTsType[name]) {
                    if (_customTsTypes[name]) {
                        addTypePathImport(resolverTypesFile, _customTsTypes[name], name, true);
                    } else {
                        const values = node.values ?? [];
                        resolverTypesFile.addEnum({
                            docs: ("description" in node && node.description?.value)
                                ? [node.description.value]
                                : undefined,
                            name,
                            isExported: true,
                            members: values.map(value => ({
                                name: value.name.value,
                                value: value.name.value,
                            })),
                        });
                    }
                }
            }

            function _createStructLike(node:
                | ObjectTypeDefinitionNode
                | ObjectTypeExtensionNode
                | InputObjectTypeDefinitionNode
                | InputObjectTypeExtensionNode
                | InterfaceTypeDefinitionNode
                | InterfaceTypeExtensionNode
            ) {
                const name = node.name.value;
                if (!_createTsType[name]) {
                    if (_customTsTypes[name]) {
                        addTypePathImport(resolverTypesFile, _customTsTypes[name], name, true);
                    } else {
                        const resolver = resolverTypesFile.addInterface({
                            docs: ("description" in node && node.description?.value)
                                ? [node.description.value]
                                : undefined,
                            name,
                            isExported: true,
                            properties: [],
                        });

                        if (node.kind === Kind.OBJECT_TYPE_DEFINITION) {
                            resolver.addProperty({
                                name: "__typename",
                                type: JSON.stringify(name),
                                hasQuestionToken: true,
                            });
                        }
                    }
                }
            }

            function _createObjectResolver(node: ObjectTypeDefinitionNode | ObjectTypeExtensionNode) {
                const name = node.name.value;
                const resolverName = `${name}Resolver`;
                if (!_createTsType[resolverName]) {
                    resolverTypesFile.addInterface({
                        name: resolverName,
                        isExported: true,
                        properties: [],
                    });

                    // add the resolver type to the root resolver type
                    rootResolverType.addProperty({
                        name,
                        type: resolverName,
                    });
                }
            }

            function _addInterfaceExtensions(node: ObjectTypeDefinitionNode | ObjectTypeExtensionNode | InterfaceTypeDefinitionNode | InterfaceTypeExtensionNode) {
                const name = node.name.value;
                const iface = resolverTypesFile.getInterface(name);
                if (!iface) {
                    // can't do anything here, it's up to the user to make sure the interface is defined before the object
                    return;
                }

                const interfaces = node.interfaces?.map(iface => iface.name.value) ?? [];
                for (const ifaceName of interfaces) {
                    iface.addExtends(ifaceName);
                }
            }

            function _deriveTsType(type: TypeNode) {
                let str = "";
                let open = 0;
                let nullable = true;

                while (true) {
                    // move along if we're at a non-null type
                    if (type.kind === Kind.NON_NULL_TYPE) {
                        type = type.type;
                        nullable = false;
                        continue;
                    }

                    // whatever type is next, wrap it in a Maybe - it's not a non-null type
                    if (nullable) {
                        str += "Maybe<";
                        open++;
                    } else {
                        nullable = true;
                    }

                    // if we're at a list type, then we need to wrap it in an Array
                    if (type.kind === Kind.LIST_TYPE) {
                        str += "Array<";
                        open++;
                        type = type.type;
                        continue;
                    }

                    // if we're here, then we're at a named type
                    str += type.name.value;
                    break;
                }

                for (let i = 0; i < open; i++) {
                    str += ">";
                }

                return str;
            }

            // TODO: union resolvers
            // TODO: enum resolvers

            // create the types needed to create a type-safe GraphQL server
            ctx.ast = visit(ctx.ast, {
                ScalarTypeDefinition(node) {
                    const name = node.name.value;
                    const type = _customTsTypes[name] ?? defaultScalarType;
                    addTypePathImport(resolverTypesFile, type, name, true);

                    // add to the root resolver type
                    rootResolverType.addProperty({
                        name,
                        type: "GraphQLScalarType",
                    });
                },
                // NOTE: ScalarTypeExtension purposely ignored
                EnumTypeDefinition(node) {
                    _createEnum(node);
                },
                EnumTypeExtension(node) {
                    _createEnum(node);
                },
                EnumValueDefinition(node, key, parent, path, ancestors) {
                    const enumName = (parent as EnumTypeDefinitionNode).name.value;
                    const enumType = resolverTypesFile.getEnumOrThrow(enumName);
                    enumType.addMember({
                        docs: node.description?.value ? [node.description.value] : undefined,
                        name: node.name.value,
                        value: node.name.value,
                    });
                },
                ObjectTypeDefinition(node) {
                    _createStructLike(node);
                    _addInterfaceExtensions(node);
                    _createObjectResolver(node);
                },
                ObjectTypeExtension(node) {
                    _createStructLike(node);
                    _addInterfaceExtensions(node);
                    _createObjectResolver(node);
                },
                InputObjectTypeDefinition(node) {
                    _createStructLike(node);
                },
                InputObjectTypeExtension(node) {
                    _createStructLike(node);
                },
                InterfaceTypeDefinition(node) {
                    _createStructLike(node);
                    _addInterfaceExtensions(node);
                },
                InterfaceTypeExtension(node) {
                    _createStructLike(node);
                    _addInterfaceExtensions(node);
                },
                FieldDefinition(node, key, parent, path, ancestors) {
                    if (!parent || Array.isArray(parent) || !("name" in parent)) {
                        return;
                    }

                    // get the parent name
                    const parentName = (parent as ObjectTypeDefinitionNode).name.value;

                    // find the "struct-like" type we created for the parent of this field
                    const structLike = resolverTypesFile.getInterfaceOrThrow(parentName);

                    // add the field to the struct-like type
                    structLike.addProperty({
                        docs: node.description?.value ? [node.description.value] : undefined,
                        name: node.name.value,
                        type: _deriveTsType(node.type),
                        hasQuestionToken: node.type.kind !== Kind.NON_NULL_TYPE,
                    });

                    // add a resolver for the field to its parent's resolver type (if it's an object)
                    if (parent.kind === Kind.OBJECT_TYPE_DEFINITION || parent.kind === Kind.OBJECT_TYPE_EXTENSION) {
                        const resolverType = resolverTypesFile.getInterfaceOrThrow(`${parentName}Resolver`);

                        // create a type to hold the arguments for this field (if it has any)
                        let argsType = "{}";

                        if (node.arguments?.length) {
                            argsType = `${parentName}${node.name.value}Args`;
                            resolverTypesFile.addInterface({
                                name: argsType,
                                isExported: true,
                                properties: node.arguments.map(arg => ({
                                    docs: arg.description?.value ? [arg.description.value] : undefined,
                                    name: arg.name.value,
                                    type: _deriveTsType(arg.type),
                                    hasQuestionToken: arg.type.kind !== Kind.NON_NULL_TYPE,
                                })),
                            });
                        }

                        const returnType = _deriveTsType(node.type);

                        resolverType.addProperty({
                            name: node.name.value,
                            type: `ResolverFn<${parentName}, ${argsType}, ${returnType}>`,
                            hasQuestionToken: true,
                        });
                    }
                },
            });


            // save the resolver types file
            await resolverTypesFile.save();
        },
    };
}