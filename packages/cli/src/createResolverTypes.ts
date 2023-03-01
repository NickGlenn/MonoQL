import { type DocumentNode, type TypeNode, Kind } from "graphql";
import { Project, ModuleDeclarationKind } from "ts-morph";
import type { Config } from "./config";
import type { Mutable } from "./parser";
import * as path from "node:path";

const BUILTIN_SCALARS = {
    String: "string",
    Int: "number",
    Float: "number",
    Boolean: "boolean",
    ID: "string",
}

/**
 * Generates the server-side resolver types for all GraphQL types in the schema.
 */
export async function createResolverTypes(ast: Mutable<DocumentNode>, config: Config, configDir: string) {

    const project = new Project();

    // track seen types and their kinds
    const seenTypes: Record<string, Kind> = {};
    for (const definition of ast.definitions) {
        if ("name" in definition && definition.name) {
            seenTypes[definition.name.value] = definition.kind;
        }
    }


    // determine the output path
    let outputPath = config.resolvers?.outputDir ?? "./src/resolvers";

    // if the path is not absolute, make it relative to the config file
    if (!path.isAbsolute(outputPath)) {
        outputPath = path.join(configDir, outputPath);
    }

    // (re)create the resolver types file
    const resolverTypesFile = project.createSourceFile(`${outputPath}/types.gen.ts`, "", { overwrite: true });

    resolverTypesFile.addTypeAlias({ name: "Ctx", type: "{}" });
    resolverTypesFile.addTypeAlias({ name: "Maybe<T>", type: "T | null" });
    resolverTypesFile.addTypeAlias({ name: "ResolverFn<S, A, R>", type: "(source: S, args: A, context: Ctx) => R | Promise<R>" });

    // create a type for scalars
    const scalars = resolverTypesFile.addInterface({
        name: "Scalar",
        isExported: true,
    });

    // add the default scalar types
    for (const [name, type] of Object.entries(BUILTIN_SCALARS)) {
        scalars.addProperty({ name, type });
    }

    // generate types for each definition in the schema
    for (const definition of ast.definitions) {
        if (!definition) continue;

        switch (definition.kind) {
            case Kind.SCHEMA_DEFINITION:
                // TODO:
                break;
            case Kind.SCALAR_TYPE_DEFINITION: {
                let type = "string";

                definition.directives = definition.directives ?? [];

                // does the scalar type specify a @ts directive?
                const tsDirectiveIndex = definition.directives.findIndex(directive => directive.name.value === "ts");
                if (tsDirectiveIndex !== -1) {
                    const tsDirective = definition.directives[tsDirectiveIndex];

                    // find the type argument
                    const typeArg = tsDirective.arguments?.find(arg => arg.name.value === "type");
                    if (typeArg && typeArg.value.kind === Kind.STRING) {
                        type = typeArg.value.value;
                    } else {
                        throw new Error(`@ts(type: string) directive must specify a string 'type' argument`);
                    }

                    // remove the directive from the definition
                    definition.directives.splice(tsDirectiveIndex, 1);
                }

                scalars.addProperty({
                    docs: [definition.description?.value ?? ""],
                    name: definition.name.value,
                    type,
                });

                // create a type alias to the scalar type
                resolverTypesFile.addTypeAlias({
                    docs: [definition.description?.value ?? ""],
                    name: definition.name.value,
                    type: `Scalar["${definition.name.value}"]`,
                    isExported: true,
                });
                break;
            }
            case Kind.ENUM_TYPE_DEFINITION:
                resolverTypesFile.addEnum({
                    docs: [definition.description?.value ?? ""],
                    name: definition.name.value,
                    isExported: true,
                    members: (definition.values ?? []).map(value => ({
                        docs: [value.description?.value ?? ""],
                        name: value.name.value,
                        value: value.name.value,
                    })),
                });

                break;
            case Kind.OBJECT_TYPE_DEFINITION: {
                // create an interface for the type shape itself
                const typeShape = resolverTypesFile.addInterface({
                    docs: [definition.description?.value ?? ""],
                    name: definition.name.value,
                    extends: (definition.interfaces ?? []).map(iface => iface.name.value),
                    isExported: true,
                });

                // create an interface for the type's resolver
                const typeResolver = resolverTypesFile.addInterface({
                    docs: [definition.description?.value ?? ""],
                    name: `${definition.name.value}Resolver`,
                    isExported: true,
                });

                // create a namespace with the same name as the type resolver - we'll put field specific types
                // in here to avoid name collisions
                const typeResolverNamespace = resolverTypesFile.addModule({
                    name: typeResolver.getName(),
                    isExported: true,
                    declarationKind: ModuleDeclarationKind.Namespace,
                });

                const typeName = typeShape.getName();
                const resolverName = typeResolver.getName();

                // add the fields to the type shape and type resolver
                // create a resolver alias to ResolverFn for each field in the type resolver namespace
                // and then create a sub-namespace for the args and return types of each field
                for (const field of definition.fields ?? []) {
                    const fieldName = field.name.value;
                    const type = determineTsType(field.type);

                    // add the field to the type shape
                    typeShape.addProperty({
                        docs: [field.description?.value ?? ""],
                        name: fieldName,
                        type: type,
                        hasQuestionToken: field.type.kind !== Kind.NON_NULL_TYPE,
                    });

                    // add the field to the type resolver
                    typeResolver.addProperty({
                        name: fieldName,
                        type: `${resolverName}.${fieldName}`,
                        hasQuestionToken: true,
                    });

                    typeResolverNamespace.addTypeAlias({
                        name: fieldName,
                        type: `ResolverFn<${typeName}, ${fieldName}.Args, ${fieldName}.Result>`,
                        isExported: true,
                    });

                    // create a namespace for the field's args and return types
                    const fieldNamespace = typeResolverNamespace.addModule({
                        name: fieldName,
                        isExported: true,
                        declarationKind: ModuleDeclarationKind.Namespace,
                    });

                    // add the args type to the field namespace
                    fieldNamespace.addInterface({
                        name: "Args",
                        isExported: true,
                        properties: (field.arguments ?? []).map(arg => ({
                            docs: [arg.description?.value ?? ""],
                            name: arg.name.value,
                            type: determineTsType(arg.type),
                            hasQuestionToken: arg.type.kind !== Kind.NON_NULL_TYPE,
                        })),
                    });

                    // add the result type to the field namespace
                    fieldNamespace.addTypeAlias({
                        name: "Result",
                        isExported: true,
                        type,
                    });

                }

                break;
            }
            case Kind.INPUT_OBJECT_TYPE_DEFINITION: {
                resolverTypesFile.addInterface({
                    docs: [definition.description?.value ?? ""],
                    name: definition.name.value,
                    isExported: true,
                    properties: (definition.fields || []).map(field => ({
                        docs: [field.description?.value ?? ""],
                        name: field.name.value,
                        type: determineTsType(field.type),
                        hasQuestionToken: field.type.kind !== Kind.NON_NULL_TYPE,
                    })),
                });
                break;
            }
            case Kind.INTERFACE_TYPE_DEFINITION: {
                resolverTypesFile.addInterface({
                    docs: [definition.description?.value ?? ""],
                    name: definition.name.value,
                    isExported: true,
                    properties: (definition.fields || []).map(field => ({
                        docs: [field.description?.value ?? ""],
                        name: field.name.value,
                        type: determineTsType(field.type),
                        hasQuestionToken: field.type.kind !== Kind.NON_NULL_TYPE,
                    })),
                });
                break;
            }
            case Kind.UNION_TYPE_DEFINITION:
                resolverTypesFile.addTypeAlias({
                    docs: [definition.description?.value ?? ""],
                    name: definition.name.value,
                    isExported: true,
                    type: (definition.types || []).map(type => type.name.value).join(" | "),
                });
                break;
        }
    }

    // save the resolver types file
    await resolverTypesFile.save();


    function determineTsType(type: Mutable<TypeNode>) {
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
            const name = type.name.value;
            if (name in BUILTIN_SCALARS) {
                str += `Scalar["${name}"]`;
            } else if (seenTypes[name]) {
                str += name;
            } else {
                throw new Error(`The type "${name}" is not defined in the schema.`);
            }

            break;
        }

        for (let i = 0; i < open; i++) {
            str += ">";
        }

        return str;
    }

}