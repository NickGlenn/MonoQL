import { DocumentNode, Kind } from "graphql";
import { Project, SyntaxKind } from "ts-morph";
import type { Config } from "./config";
import type { Mutable } from "./parser";

/**
 * Scaffolds out resolvers as individual functions if it can't be found in any
 * of the files within the specified "resolvers" directory.
 */
export function scaffoldResolvers(ast: Mutable<DocumentNode>, config: Config) {
    // find all the resolver files in the resolvers/ directory and load them
    // with TS morph
    const project = new Project();

    // get the resolvers directory
    const resolversDir = config.resolvers?.outputDir ?? "./src/resolvers";

    for (const definition of ast.definitions) {
        if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION) {
            continue;
        }

        // what type of resolver format are we using for this type?
        const format = config.resolvers.overrides?.[definition.name.value] ?? config.resolvers.format ?? "file";
        if (format === "none") {
            continue;
        }

        // if the format is "file" then we're looking for a file with the same name as the
        // type that exports typed constants for each resolver field
        if (format === "file") {
            // find the resolver file for this type or create it if it doesn't exist
            let resolverFile = project.getSourceFile(`${resolversDir}/${definition.name.value}.ts`);
            if (!resolverFile) {
                resolverFile = project.createSourceFile(`${resolversDir}/${definition.name.value}.ts`, "", { overwrite: true })!;
            }

            // find the import for the resolver interface and add the import if it doesn't exist
            let resolverImport = resolverFile.getImportDeclaration(`./types.gen`);
            if (!resolverImport) {
                resolverImport = resolverFile.addImportDeclaration({
                    moduleSpecifier: `./types.gen`,
                    namedImports: [`${definition.name.value}Resolver`],
                });
            }

            // find or create the exported resolver constant for this GraphQL type
            // we'll add missing fields to this constant as we go and we'll strip off
            // any fields that are no longer in the GraphQL type
            let resolverConst = resolverFile.getVariableStatement(definition.name.value);
            if (!resolverConst) {
                resolverConst = resolverFile.addVariableStatement({
                    isExported: true,
                    declarations: [{
                        name: definition.name.value,
                        type: `${definition.name.value}Resolver`,
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
            let resolverDir = project.getDirectory(`${resolversDir}/${definition.name.value}`);
            if (!resolverDir) {
                resolverDir = project.createDirectory(`${resolversDir}/${definition.name.value}`);
            }

            // find or create the index.ts file for this type
            let resolverIndexFile = resolverDir.getSourceFile("index.ts");
            if (!resolverIndexFile) {
                resolverIndexFile = resolverDir.createSourceFile("index.ts", "", { overwrite: true })!;
            }

            // find the import for the resolver interface and add the import if it doesn't exist
            let resolverImport = resolverIndexFile.getImportDeclaration(`./types.gen`);
            if (!resolverImport) {
                resolverImport = resolverIndexFile.addImportDeclaration({
                    moduleSpecifier: `./types.gen`,
                    namedImports: [`${definition.name.value}Resolver`],
                });
            }

            for (const field of definition.fields || []) {
                const fieldName = field.name.value;

                // create the file for the resolver constant for this field if it doesn't exist
                let resolverFile = resolverDir.getSourceFile(`${fieldName}.ts`);
                if (!resolverFile) {
                    resolverFile = resolverDir.createSourceFile(`${fieldName}.ts`, "", { overwrite: true })!;
                }

                // make sure the file exports a constant with the same name as the field
                // and the same type as the resolver function
                let resolverConst = resolverFile.getVariableStatement(fieldName);
                if (!resolverConst) {
                    resolverConst = resolverFile.addVariableStatement({
                        isExported: true,
                        declarations: [{
                            name: fieldName,
                            type: `${definition.name.value}Resolver["${fieldName}"]`,
                            initializer: "async (src, args, ctx) => { throw new Error(\"Not implemented yet\"); }",
                        }],
                    });
                } else {
                    // if the constant already exists then make sure it has the correct type
                    const resolverConstDecl = resolverConst.getDeclarations()[0];
                    if (resolverConstDecl.getType().getText() !== `${fieldName}Resolver`) {
                        resolverConstDecl.setType(`${fieldName}Resolver`);
                    }
                }
            }

            //
        }
    }
}