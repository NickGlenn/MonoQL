import { Kind, TypeNode, type TypeDefinitionNode } from "graphql";
import type * as ts from "ts-morph";
import { ScalarDef } from "./ScalarDef";
import { pascal } from "case";

/**
 * Generates the Typescript equivalents for the resulting GraphQL schema. This
 * takes the GraphQL ASTs, combines them, and generates ONLY the types for what
 * is exposed via GraphQL as our API surface.
 */
export function generateApiTypes({ types, genAst, userAst, output }: BuildCtx) {
    const defs = genAst.definitions
        .concat((userAst?.definitions ?? []) as Mutable<TypeDefinitionNode>[]);

    const ns = output.addModule({
        name: "Api",
        isExported: true,
    });

    const scalarMap = ns.addInterface({
        name: "ScalarMap",
        isExported: true,
        properties: [],
    });

    for (const t of Object.values(types)) {
        if (!(t instanceof ScalarDef)) continue;

        const docs = t.desc ? [t.desc] : [];
        const type = t.tsType;
        const name = t.name;

        scalarMap.addProperty({
            name,
            type: type,
            docs,
        });
    }

    // add the user's own scalars and enums to the map
    for (const def of userAst?.definitions ?? []) {
        if (def.kind !== Kind.SCALAR_TYPE_DEFINITION) continue;
        if (scalarMap.getProperty(def.name.value)) continue;
        const docs = def.description ? [def.description.value] : [];
        const name = def.name.value;

        scalarMap.addProperty({
            name,
            type: "any",
            docs,
        });
    }

    const scalarNames: string[] = scalarMap.getProperties().map(p => p.getName());

    for (const def of defs) {
        const docs = "description" in def && def.description ?
            [def.description.value] : [];

        switch (def.kind) {
            case Kind.ENUM_TYPE_DEFINITION:
            case Kind.ENUM_TYPE_EXTENSION: {
                const name = def.name.value;
                output.addEnum({
                    name,
                    docs,
                    isExported: true,
                    members: def.values?.map(member => {
                        const name = member.name.value;
                        let value = name;
                        const tagIdx = member.directives?.findIndex(d => d.name.value === "mql") ?? -1;
                        if (tagIdx !== -1) {
                            const [tag] = member.directives!.splice(tagIdx, 1);
                            const arg = tag!.arguments?.find(a => a.name.value === "as");
                            if (arg) {
                                if (
                                    arg.value.kind === Kind.STRING ||
                                    arg.value.kind === Kind.ENUM
                                ) {
                                    value = arg.value.value;
                                } else {
                                    throw new Error(`Invalid 'as' argument for @mql directive on ${name}.${value}.`);
                                }
                            } else {
                                throw new Error(`Missing 'as' argument for @mql directive on ${name}.${value}.`);
                            }
                        }

                        return {
                            name: name,
                            docs: member.description ? [member.description.value] : [],
                            value,
                        };
                    }) ?? [],
                });
                break;
            }
            case Kind.OBJECT_TYPE_DEFINITION:
            case Kind.OBJECT_TYPE_EXTENSION: {
                const name = def.name.value;
                const dto = getOrCreateInterface(ns, {
                    name,
                    docs,
                    isExported: true,
                    extends: def.interfaces?.map(i => i.name.value) ?? [],
                });

                const resolvers = getOrCreateInterface(ns, {
                    name: `${name}Resolvers`,
                    docs,
                    isExported: true,
                });

                for (const f of def.fields ?? []) {
                    const docs = f.description ? [f.description.value] : [];
                    const optional = f.type.kind !== Kind.NON_NULL_TYPE;
                    const type = getTsEquivalent(scalarNames, f.type, false);
                    dto.addProperty({
                        name: f.name.value,
                        type,
                        hasQuestionToken: optional,
                        docs,
                    });

                    // create a type for the resolver arguments
                    let args: ts.InterfaceDeclaration | undefined;
                    if (f.arguments?.length) {
                        args = getOrCreateInterface(ns, {
                            name: `${name}${pascal(f.name.value)}Args`,
                            docs,
                            isExported: true,
                            properties: f.arguments?.map(a => {
                                const docs = a.description ? [a.description.value] : [];
                                const optional = a.type.kind !== Kind.NON_NULL_TYPE;
                                const type = getTsEquivalent(scalarNames, a.type, false);

                                return {
                                    name: a.name.value,
                                    type,
                                    hasQuestionToken: optional,
                                    docs,
                                };
                            }, []) ?? [],
                        });
                    }

                    resolvers.addProperty({
                        name: f.name.value,
                        type: args
                            ? `Resolver<${name}, ${type}, ${args.getName()}>`
                            : `Resolver<${name}, ${type}>`,
                        docs,
                        hasQuestionToken: true,
                    });
                }
                break;
            }
            case Kind.INPUT_OBJECT_TYPE_DEFINITION:
            case Kind.INPUT_OBJECT_TYPE_EXTENSION: {
                const name = def.name.value;
                const iface = getOrCreateInterface(ns, {
                    name,
                    docs,
                    isExported: true,
                });

                for (const f of def.fields ?? []) {
                    const docs = f.description ? [f.description.value] : [];
                    const optional = f.type.kind !== Kind.NON_NULL_TYPE;
                    const type = getTsEquivalent(scalarNames, f.type, false);
                    iface.addProperty({
                        name: f.name.value,
                        type,
                        hasQuestionToken: optional,
                        docs,
                    });
                }

                break;
            }
            case Kind.UNION_TYPE_DEFINITION:
            case Kind.UNION_TYPE_EXTENSION: {
                const name = def.name.value;
                const type = def.types?.map(t => t.name.value) ?? [];

                output.addTypeAlias({
                    name,
                    docs,
                    isExported: true,
                    type: type.join(" | "),
                });
                break;
            }
        }
    }
}

function getOrCreateInterface(
    ns: ts.ModuleDeclaration,
    opts: ts.OptionalKind<ts.InterfaceDeclarationStructure>,
) {
    return ns.getInterface(opts.name) || ns.addInterface(opts);
}

function getTsEquivalent(scalars: string[], type: Mutable<TypeNode>, nullable: boolean): string {
    let out = "";

    switch (type.kind) {
        case Kind.NAMED_TYPE: {
            const name = type.name.value;
            out += scalars.includes(name) ? `ScalarMap["${name}"]` : name;
            break;
        }
        case Kind.NON_NULL_TYPE:
            out += getTsEquivalent(scalars, type.type, false);
            break;
        case Kind.LIST_TYPE:
            out += `Array<${getTsEquivalent(scalars, type.type, true)}>`;
            break;
    }

    if (nullable && type.kind !== Kind.NON_NULL_TYPE) {
        out = `Maybe<${out}>`;
    }

    return out;
}