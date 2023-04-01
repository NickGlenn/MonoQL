import { codegen } from "@graphql-codegen/core";
import * as typescriptCodegen from "@graphql-codegen/typescript";
import * as typescriptResolversCodegen from "@graphql-codegen/typescript-resolvers";
import type { TypeScriptPluginConfig } from "@graphql-codegen/typescript";
import type { TypeScriptResolversPluginConfig } from "@graphql-codegen/typescript-resolvers";
import { Project, SourceFile, SyntaxKind, VariableDeclarationKind } from "ts-morph";
import type { PipelineAction } from "../index";
import { visit } from "graphql";
import { relative, resolve } from "path";

export type GenerateResolversOptions = {
    /** Output path for the generated resolver types. */
    resolverTypesOutput: string;
    /** Output path for the scaffolded resolvers. If not provided, scaffolding will be skipped. */
    resolversOutputDir?: string;
    /** Default mode used when scaffolding resolvers. */
    defaultScaffoldMode?: "none" | "file" | "dir";
}
    & TypeScriptPluginConfig
    & TypeScriptResolversPluginConfig;

/**
 * Preset for generating Typescript types and resolver types. Can also scaffold out resolver
 * methods/files based on the schema and modify existing TypeScript files to add missing
 * resolver methods.
 */
export function generateResolvers({
    resolverTypesOutput,
    resolversOutputDir,
    defaultScaffoldMode = "file",
    ...config
}: GenerateResolversOptions): PipelineAction {
    return {
        name: "Generate Resolvers",
        async execute(ctx) {
            const project = new Project();

            config = {
                useTypeImports: true,
                ...config,
            };

            const result = await codegen({
                schema: ctx.ast,
                documents: [],
                config: {},
                filename: "",
                plugins: [
                    { typescript: config },
                    { typescriptResolvers: config },
                ],
                pluginMap: {
                    typescript: typescriptCodegen,
                    typescriptResolvers: typescriptResolversCodegen,
                },
            });

            project.createSourceFile(resolverTypesOutput, result, { overwrite: true });

            if (resolversOutputDir) {
                project.addDirectoryAtPath(resolversOutputDir, {
                    recursive: true,
                });

                const seenResolvers: string[] = [];

                ctx.ast = visit(ctx.ast, {
                    ObjectTypeDefinition(node) {
                        let mode = defaultScaffoldMode;

                        const name = node.name.value;

                        // does the node have a @resolver directive?
                        const resolverDirective = node.directives?.find(d => d.name.value === "resolver");
                        if (resolverDirective) {
                            // does the resolver specify a valid mode/type?
                            const typeArg = resolverDirective?.arguments?.find(a => a.name.value === "type")?.value;
                            if (typeArg?.kind === "EnumValue") {
                                const value = typeArg.value.toLowerCase();
                                if (value === "none" || value === "file" || value === "dir") {
                                    mode = value;
                                } else {
                                    throw new Error(`Invalid resolver type "${typeArg.value}" for ${node.name.value}`);
                                }
                            }
                        }

                        if (mode === "none") return;

                        const fields = node.fields || [];
                        seenResolvers.push(name);

                        // we need to create a resolver file that either houses all the resolvers for this
                        // type or combines the resolvers from each individual file into a single object
                        let rootfile: SourceFile;

                        if (mode === "dir") {
                            // always create this file if we're using a directory structure
                            rootfile = project.createSourceFile(`${resolversOutputDir}/${node.name.value}/index.ts`, "", { overwrite: true });
                        } else {
                            // find or create the root resolver file if it's missing
                            rootfile = findOrCreateFileIfMissing(project, `${resolversOutputDir}/${node.name.value}.ts`);
                        }

                        // find or create the root resolver declaration to the file if it's missing
                        let resolverDeclaration = rootfile.getVariableStatement(node.name.value);
                        if (!resolverDeclaration) {
                            rootfile.addImportDeclaration({
                                namedImports: [`${name}Resolvers`],
                                moduleSpecifier: findRelativeModulePath(rootfile.getDirectoryPath(), resolverTypesOutput),
                                isTypeOnly: true,
                            });

                            resolverDeclaration = rootfile.addVariableStatement({
                                declarationKind: VariableDeclarationKind.Const,
                                isExported: true,
                                declarations: [{
                                    type: `${name}Resolvers`,
                                    name: name,
                                    initializer: "{}",
                                }],
                            });
                        }

                        // get the object literal expression for the resolver declaration
                        const rootResolverObject = resolverDeclaration.getDeclarations()[0]
                            .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);

                        // add the missing resolver methods to the resolver declaration
                        for (const field of fields) {
                            // if args is zero and there is no @resolved directive, then we can skip it
                            if (field.arguments?.length === 0 && !field.directives?.find(d => d.name.value === "resolved")) continue;

                            // if the resolver declaration already has a method for this field, then skip it
                            const existingMethod = rootResolverObject.getProperty(field.name.value);
                            if (existingMethod) continue;

                            if (mode === "file") {
                                // add the method to the resolver declaration if it's missing
                                if (!rootResolverObject.getProperty(field.name.value)) {
                                    rootResolverObject.addPropertyAssignment({
                                        name: field.name.value,
                                        initializer: `(src, args, ctx) => { throw new Error("Resolver not implemented"); }`,
                                    });
                                }
                            } else {
                                // create a new file for the resolver method
                                const resolverFile = findOrCreateFileIfMissing(project, `${resolversOutputDir}/${node.name.value}/${field.name.value}.ts`);

                                if (!resolverFile.isSaved()) {
                                    resolverFile.addImportDeclaration({
                                        moduleSpecifier: findRelativeModulePath(resolverFile.getDirectoryPath(), resolverTypesOutput),
                                        namedImports: [`${name}Resolvers`],
                                        isTypeOnly: true,
                                    });

                                    resolverFile.addTypeAlias({
                                        name: "ResolverFn",
                                        type: `${name}Resolvers["${field.name.value}"]`,
                                    });

                                    resolverFile.addVariableStatement({
                                        declarationKind: VariableDeclarationKind.Const,
                                        isExported: true,
                                        declarations: [{
                                            // trailingTrivia: " satisfies ResolverFn",
                                            name: field.name.value,
                                            type: "ResolverFn",
                                            initializer: "(src, args, ctx) => {\n\nthrow new Error(\"Resolver not implemented\");\n\n}",
                                        }],
                                    });
                                }

                                // does the rootfile already have an import for this file?
                                // if not, then add it
                                const resolverModulePath = findRelativeModulePath(rootfile.getDirectoryPath(), resolverFile.getFilePath());
                                const existingImport = rootfile.getImportDeclaration(resolverModulePath);
                                if (!existingImport) {
                                    // add the method to the resolver declaration
                                    rootfile.addImportDeclaration({
                                        moduleSpecifier: resolverModulePath,
                                        namedImports: [field.name.value],
                                    });

                                    rootResolverObject.addPropertyAssignment({
                                        name: field.name.value,
                                        initializer: field.name.value,
                                    });
                                }
                            }
                        }

                        // if we get here and there are no fields added, then we can delete the file in
                        // memory before we even save it
                        if (rootResolverObject.getProperties().length === 0) {
                            rootfile.delete();
                            seenResolvers.pop();
                            return;
                        }

                        if (mode === "dir") {
                            rootfile.insertStatements(0, `// This file is auto-generated. Do not edit it directly.`);
                        }
                    },
                    Directive(node) {
                        // strip out the @resolver and @resolved directives
                        if (node.name.value === "resolver" || node.name.value === "resolved") {
                            return null;
                        }
                    },
                });

                // scaffold out the resolvers root file and add whatever is missing to it
                const rootResolversFile = findOrCreateFileIfMissing(project, `${resolversOutputDir}/resolvers.ts`);
                const resolverTypeModulePath = findRelativeModulePath(rootResolversFile.getDirectoryPath(), resolverTypesOutput);

                if (!rootResolversFile.getImportDeclaration(resolverTypeModulePath)) {
                    rootResolversFile.addImportDeclaration({
                        moduleSpecifier: resolverTypeModulePath,
                        namedImports: [`Resolvers`],
                        isTypeOnly: true,
                    });
                }

                let rootResolversVar = rootResolversFile.getVariableStatement("resolvers");
                if (!rootResolversVar) {
                    rootResolversVar = rootResolversFile.addVariableStatement({
                        declarationKind: VariableDeclarationKind.Const,
                        isExported: true,
                        declarations: [{
                            type: "Resolvers",
                            name: "resolvers",
                            initializer: "{}",
                        }],
                    });
                }

                const resolversObj = rootResolversVar
                    .getDeclarations()[0]
                    .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);

                // seenResolvers is a list of all the types that have resolvers we may have scaffolded
                // add them to the root resolvers file if they're missing
                for (const resolver of seenResolvers) {
                    if (!resolversObj.getProperty(resolver)) {
                        rootResolversFile.addImportDeclaration({
                            moduleSpecifier: `./${resolver}`,
                            namedImports: [resolver],
                        });

                        resolversObj.addPropertyAssignment({
                            name: resolver,
                            initializer: resolver,
                        });
                    }
                }
            }

            await project.save();
        },
    };
}


function findOrCreateFileIfMissing(project: Project, path: string) {
    let file = project.addSourceFileAtPathIfExists(resolve(path));
    if (!file) {
        file = project.createSourceFile(resolve(path), "");
    }
    return file;
}

function findRelativeModulePath(from: string, to: string) {
    let path = relative(from, to).replace(/\\/g, "/");

    if (!path.startsWith(".")) {
        path = `./${path}`;
    }

    if (path.endsWith(".ts")) {
        path = path.slice(0, -3);
    }

    return path.replace(/\\/g, "/");
}