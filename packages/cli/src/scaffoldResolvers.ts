import { DocumentNode, Kind } from "graphql";
import { Project, SyntaxKind, VariableDeclarationKind } from "ts-morph";
import type { Config } from "./config";
import type { Mutable } from "./parser";
import * as path from "node:path";

/**
 * Scaffolds out resolvers as individual functions if it can't be found in any
 * of the files within the specified "resolvers" directory.
 */
export async function scaffoldResolvers(ast: Mutable<DocumentNode>, config: Config, configDir: string) {
    // find all the resolver files in the resolvers/ directory and load them
    // with TS morph
    const project = new Project();

    // get the resolvers directory
    let resolversDir = config.resolvers?.outputDir ?? "./src/resolvers";

    // if the path is not absolute, make it relative to the config file
    if (!path.isAbsolute(resolversDir)) {
        resolversDir = path.join(configDir, resolversDir);
    }

    // TODO: move this
    config.resolvers = {
        overrides: {
            Query: "directory",
            Mutation: "directory",
        }
    };


    for (const definition of ast.definitions) {

        // TODO: union types

        if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION) {
            continue;
        }

        const typeName = definition.name.value;

        // what type of resolver format are we using for this type?
        const format = config.resolvers?.overrides?.[typeName] ?? config.resolvers?.format ?? "file";
        if (format === "none") {
            continue;
        }

        // if the format is "file" then we're looking for a file with the same name as the
        // type that exports typed constants for each resolver field
        if (format === "file") {
            // find the resolver file for this type or create it if it doesn't exist
            let resolverFile = project.getSourceFile(`${resolversDir}/${typeName}.ts`);
            if (!resolverFile) {
                resolverFile = project.createSourceFile(`${resolversDir}/${typeName}.ts`, "", { overwrite: true })!;
            }

            // find the import for the resolver interface and add the import if it doesn't exist
            let resolverImport = resolverFile.getImportDeclaration(`./types.gen`);
            if (!resolverImport) {
                resolverImport = resolverFile.addImportDeclaration({
                    moduleSpecifier: `./types.gen`,
                    namedImports: [`${typeName}Resolver`],
                    isTypeOnly: true,
                });
            }

            // find or create the exported resolver constant for this GraphQL type
            // we'll add missing fields to this constant as we go and we'll strip off
            // any fields that are no longer in the GraphQL type
            let resolverConst = resolverFile.getVariableStatement(typeName);
            if (!resolverConst) {
                resolverConst = resolverFile.addVariableStatement({
                    isExported: true,
                    declarationKind: VariableDeclarationKind.Const,
                    declarations: [{
                        name: typeName,
                        type: `${typeName}Resolver`,
                        initializer: "{}",
                    }],
                });
            }

            // get the object literal expression for the resolver constant
            const resolverConstObj = resolverConst.getDeclarations()[0].getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);

            // ensure that each field that needs a resolver on the GraphQL type has an exported
            // constant with the same name as the field and the same type as the resolver function
            for (const field of definition.fields || []) {
                const fieldName = field.name.value;

                // determine if the field needs a resolver - currently we determine this automatically
                // by checking if the field has any arguments
                const hasArgs = field.arguments?.length ?? 0 > 0;
                if (!hasArgs) {
                    continue;
                }

                // does the resolver constant already have a property for this field?
                const resolverConstProp = resolverConstObj.getProperty(fieldName);
                if (resolverConstProp) {
                    // skip this field if it already has a resolver
                    continue;
                }

                // add a new property to the resolver constant for this field
                resolverConstObj.addMethod({
                    name: fieldName,
                    isAsync: true,
                    statements: `throw new Error("Not implemented yet");`,
                });
            }

            continue;
        }

        // if the format is "directory" then we're looking for a directory with the same name
        // as the type that contains files per resolver field that export a single constant
        // for the resolver function with the same name as the file - each found resolver will
        // be loaded into an index.ts file that exports all the resolvers for this type as an object
        if (format === "directory") {

            // find the resolver directory for this type or create it if it doesn't exist
            let resolverDir = project.getDirectory(`${resolversDir}/${typeName}`);
            if (!resolverDir) {
                resolverDir = project.createDirectory(`${resolversDir}/${typeName}`);
            }

            definition.fields = definition.fields || [];

            for (const field of definition.fields) {
                const fieldName = field.name.value;

                // create the file for the resolver constant for this field if it doesn't exist
                let resolverFile = resolverDir.getSourceFile(`${fieldName}.ts`);
                if (!resolverFile) {
                    resolverFile = resolverDir.createSourceFile(`${fieldName}.ts`, "", { overwrite: true })!;
                }

                // find the import for the resolver interface and add the import if it doesn't exist
                let resolverImport = resolverFile.getImportDeclaration(`../types.gen`);
                if (!resolverImport) {
                    resolverImport = resolverFile.addImportDeclaration({
                        moduleSpecifier: `../types.gen`,
                        namedImports: [`${typeName}Resolver`],
                        isTypeOnly: true,
                    });
                }

                // make sure the file exports a constant with the same name as the field
                // and the same type as the resolver function
                let resolverConst = resolverFile.getVariableStatement(fieldName);
                if (!resolverConst) {
                    resolverConst = resolverFile.addVariableStatement({
                        isExported: true,
                        declarationKind: VariableDeclarationKind.Const,
                        declarations: [{
                            name: fieldName,
                            type: `${typeName}Resolver.${fieldName}`,
                            initializer: "async (src, args, ctx) => { throw new Error(\"Not implemented yet\"); }",
                        }],
                    });
                } else {
                    // if the constant already exists then make sure it has the correct type
                    const resolverConstDecl = resolverConst.getDeclarations()[0];
                    if (resolverConstDecl.getType().getText() !== `${fieldName}Resolver.${fieldName}`) {
                        resolverConstDecl.setType(`${fieldName}Resolver.${fieldName}`);
                    }
                }
            }

            // create the index.ts file that exports all the resolvers for this type as an object
            let resolverIndexFile = resolverDir.createSourceFile("index.ts", "", { overwrite: true });

            // find the import for the resolver interface and add the import if it doesn't exist
            let resolverImport = resolverIndexFile.getImportDeclaration(`../types.gen`);
            if (!resolverImport) {
                resolverImport = resolverIndexFile.addImportDeclaration({
                    moduleSpecifier: `../types.gen`,
                    namedImports: [`${typeName}Resolver`],
                    isTypeOnly: true,
                });
            }

            for (const field of definition.fields) {
                const fieldName = field.name.value;

                // add an import for the resolver constant for this field
                resolverIndexFile.addImportDeclaration({
                    moduleSpecifier: `./${fieldName}`,
                    namedImports: [fieldName],
                });
            }

            // add the exported resolver object for this type
            resolverIndexFile.addVariableStatement({
                isExported: true,
                declarationKind: VariableDeclarationKind.Const,
                declarations: [{
                    name: typeName,
                    type: `${typeName}Resolver`,
                    initializer: `{\n${definition.fields.map(f => `${f.name.value},`).join("\n")} }`,
                }],
            });
        }
    }

    await project.save();
}