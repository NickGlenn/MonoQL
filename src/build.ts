// import { print, Kind } from "graphql";
// import type { Mutable } from "./internal";
// import { ConfigWithDefaults } from "./config";
// import * as ts from "ts-morph";
// import { mkdir, writeFile } from "fs/promises";
// import { renderTemplate } from "./utils";
// import type { DocumentNode, ObjectTypeExtensionNode, TypeDefinitionNode } from "graphql";
// import { resolveGql } from "./typeResolution";
// import { createGraphQLEnumType, createGraphQLInterfaceType, createGraphQLObjectType, createGraphQLScalarType } from "./gql";
// import type { Document as PipelineStage } from "mongodb";
// import type { ISchemaDef } from "./Schema";
// // import pluralize from "pluralize";
// // import { camel } from "case";


// /** Context of the generation pipeline. */
// export 

// const graphqlScalars = [
//     "Int",
//     "Float",
//     "String",
//     "Boolean",
//     "ID",
// ];

// /**
//  * Executes the generation pipeline and builds the MonoQL backend.
//  */
// export async function runBuildPipeline(
//     config: ConfigWithDefaults,
//     types: Record<string, ISchemaDef>,
// ) {
//     const project = new ts.Project({ tsConfigFilePath: config.tsConfigPath });
//     const output = project.createSourceFile(config.serverFileOutput, "", { overwrite: true });
//     await renderTemplate(output, "baseline");

    // const genAst: Mutable<DocumentNode> = {
    //     kind: Kind.DOCUMENT,
    //     definitions: [],
    // };
    // const userAst = null as null | DocumentNode; // TODO: load user schema
    // const typeQueue = Object.values(types);

    // // gather model collections and create an object that maps all collections to
    // // the models that belong to them
    // const collections = typeQueue.reduce((acc, t) => {
    //     if (t.__kind === "model") {
    //         if (acc[t.collection]) acc[t.collection]!.push(t.name);
    //         else acc[t.collection] = [t.name];
    //     }
    //     return acc;
    // }, {} as Record<string, string[]>);

    // const queryTables: Record<string, {
    //     // is the table shared between multiple models?
    //     sharedCollection: boolean;
    //     // when these filters are present, what pipeline stages are introduced?
    //     filters: Record<string, PipelineStage>;
    //     // when these selections are present, what pipeline stages are introduced?
    //     selections: Record<string, PipelineStage>;
    // }> = {};
    // const resolverObjects: Record<string, ts.ObjectLiteralExpression> = {};
    // // const resolverTypes: Record<string, ts.Type> = {};

    // // create our indexes for each collection
    // const indexesByCollection: Record<string, {}[]> = {};
    // for (const collection in collections) {
    //     // the "_type" field is a given index
    //     indexesByCollection[collection] = [{ _type: 1 }];
    // }

    // // create a lookup type in Typescript for the scalars
    // const scalarMap = output.addInterface({
    //     name: "ScalarMap",
    //     isExported: true,
    // });

    // // process the types in the queue
    // while (typeQueue.length > 0) {
    //     const t = typeQueue.shift()!;
    //     let gql: Mutable<TypeDefinitionNode | ObjectTypeExtensionNode> | null = null;

    //     if (userAst) {
    //         checkForNameCollision(userAst, t.name);
    //     }

    //     switch (t.__kind) {
    //         case "scalar": {
    //             // generate the GraphQL definition (if missing)
    //             if (!graphqlScalars.includes(t.name)) {
    //                 gql = createGraphQLScalarType(t);
    //             }

    //             scalarMap.addProperty({
    //                 name: t.name,
    //                 type: `{ input: ${t.tsType}, output: ${t.tsType} }`,
    //                 docs: t.docs ? [t.docs] : undefined,
    //             });

    //             // TODO: insert/import the resolvers for the scalars
    //             // TODO: custom scalar support from user schema?

    //             break;
    //         }
    //         case "enum": {
    //             gql = createGraphQLEnumType(t);

    //             output.addEnum({
    //                 name: t.name,
    //                 isExported: true,
    //                 docs: t.docs ? [t.docs] : undefined,
    //                 members: Object.entries(t.values).map(([k, v]) => ({
    //                     name: k,
    //                     value: v.value ?? k,
    //                     docs: v.docs ? [v.docs] : undefined,
    //                 })),
    //             });

    //             break;
    //         }
    //         case "interface": {
    //             if (!t.abstract) {
    //                 gql = createGraphQLInterfaceType(t);
    //             }

    //             output.addInterface({
    //                 name: t.name,
    //                 isExported: true,
    //                 docs: t.docs ? [t.docs] : undefined,
    //             });

    //             // TODO: add fields to the interface

    //             break;
    //         }
    //         case "object": {
    //             const extension = (t.name === "Query" || t.name === "Mutation") &&
    //                 userAst?.definitions.find(d => d.kind === "ObjectTypeExtension" && d.name.value === t.name);

    //             gql = createGraphQLObjectType({ ...t, extended: !!extension });

    //             // create the type that will represent the data-transfer object
    //             output.addInterface({
    //                 name: t.name,
    //                 isExported: true,
    //                 docs: t.docs ? [t.docs] : undefined,
    //             });

    //             // TODO: add fields to the interface

    //             const [decl] = output.addVariableStatement({
    //                 declarationKind: ts.VariableDeclarationKind.Const,
    //                 isExported: true,
    //                 declarations: [{
    //                     name: t.name + "Resolvers",
    //                     initializer: "{}",
    //                 }],
    //             }).getDeclarations();
    //             if (!decl) throw new Error(`Failed to access created ${t.name}Resolvers object declaration.`);
    //             // const obj = decl.asKindOrThrow(ts.SyntaxKind.ObjectLiteralExpression);
    //             // resolverObjects[t.name] = obj;

    //             break;
    //         }
    //         case "union": {
    //             const types = typeof t.types === "function" ? t.types() : t.types;

    //             gql = createGraphQLInterfaceType(t);

    //             output.addTypeAlias({
    //                 name: t.name,
    //                 isExported: true,
    //                 type: types.map(st => st.name).join(" | "),
    //                 docs: t.docs ? [t.docs] : undefined,
    //             });

    //             break;
    //         }
    //         case "model": {
    //             gql = createGraphQLObjectType(t);

    //             if (!indexesByCollection[t.collection]) {
    //                 indexesByCollection[t.collection] = [];
    //             }

    //             output.addInterface({
    //                 name: t.name,
    //                 isExported: true,
    //                 docs: t.docs ? [t.docs] : undefined,
    //                 properties: [{
    //                     name: "_id",
    //                     type: "ObjectId",
    //                 }, {
    //                     name: "_type",
    //                     type: `"${t.name}"`,
    //                 }],
    //             });

    //             // TODO: determine all indexes for this model and account for sub objects used
    //             // TODO: generate the index function for this model/collection

    //             // get the various naming conventions for the model and its collection
    //             // const listQueryName = pluralize(camel(t.name));

    //             // TODO: create a function for creating a new model
    //             // TODO: create a function for updating a model
    //             // TODO: create a function for deleting a model

    //             // TODO: push query and mutation fields into the queue

    //             break;
    //         }
    //     }

    //     if (!gql) continue;

    //     if ("fields" in gql && "fields" in t) {
    //         for (const [name, field] of Object.entries(t.fields)) {
    //             const fieldType = typeof field.type === "function"
    //                 ? field.type() : field.type;

    //             let gqlType = resolveGql(types, fieldType);

    //             // TODO: is pagination applicable to this field?
    //             // TODO: is this field internal?


    //             (gql.fields as any).push({
    //                 kind: Kind.FIELD_DEFINITION,
    //                 name: { kind: Kind.NAME, value: name },
    //                 description: { kind: Kind.STRING, value: field.docs || "" },
    //                 type: gqlType,
    //                 arguments: Object.entries(field.args ?? {}).map(([name, arg]) => ({
    //                     kind: Kind.INPUT_VALUE_DEFINITION,
    //                     name: { kind: Kind.NAME, value: name },
    //                     description: { kind: Kind.STRING, value: arg.docs || "" },
    //                     type: resolveGql(types, typeof arg.type === "function"
    //                         ? arg.type() : arg.type),
    //                 })),
    //             });
    //         }
    //     }

    //     genAst.definitions.push(gql as Mutable<TypeDefinitionNode>);
    // }

    // output.insertText(0, "// This file is generated by MonoQL. Do not edit.\n\n");
    // output.formatText();

    // await mkdir(config.outDir, { recursive: true });
    // await output.save();
    // await writeFile(config.schemaOutput,
    //     "# This file is generated by MonoQL. Do not edit.\n\n"
    //     + print(genAst as DocumentNode)
    // );

    // console.log("Generated MonoQL backend.");
// }


// function checkForNameCollision(userAst: DocumentNode, name: string) {
//     for (const definition of userAst.definitions) {
//         if ("name" in definition && definition.name?.value === name) {
//             throw new Error(`"${name}" is already in use by another type in your schema.`);
//         }
//     }
// }