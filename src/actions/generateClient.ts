import { codegen } from "@graphql-codegen/core";
import type { Types } from "@graphql-codegen/plugin-helpers";
import * as typescriptCodegen from "@graphql-codegen/typescript";
import * as typescriptOperationsCodegen from "@graphql-codegen/typescript-operations";
import type { TypeScriptPluginConfig } from "@graphql-codegen/typescript";
import type { TypeScriptDocumentsPluginConfig } from "@graphql-codegen/typescript-operations";
import glob from "glob";
import { Kind, parse } from "graphql";
import { readFile } from "node:fs/promises";
import { Project } from "ts-morph";
import { addTypePathImport, TypePath } from "../internal";
import { PipelineAction } from "../runner";

export type GenerateClientConfig = {
    /** Determines what client formula to use. */
    client: "graphql-request" | "apollo" | "urql";
    /** Path to where the GraphQL client is created, relative to the location of the `path` file. */
    clientPath: TypePath;
    /** Where the generated client code will be saved. */
    clientOutput: string;
    /** Glob pattern for the GraphQL documents to include. */
    documents: string | string[];
    /** Specify a frontend framework to generate additional code for. */
    // TODO: add other frameworks
    framework?: "svelte";
}
    & TypeScriptPluginConfig
    & TypeScriptDocumentsPluginConfig;

/**
 * Generates client code from a GraphQL schema.
 */
export function generateClient(config: GenerateClientConfig): PipelineAction {
    const {
        client,
        clientPath,
        clientOutput,
        documents,
    } = config;

    return {
        name: "Generate Client",
        async execute(ctx) {
            const project = new Project();

            const sourceFile = project.createSourceFile(clientOutput, undefined, {
                overwrite: true,
            });

            // find all the documents
            const documentPaths = Array.isArray(documents) ? documents : [documents];
            const _documents: Types.DocumentFile[] = [];

            for (const documentPath of documentPaths) {
                const foundFiles = glob.sync(documentPath, { absolute: true });

                for (const foundFile of foundFiles) {
                    const contents = await readFile(foundFile, "utf8");

                    _documents.push({
                        location: foundFile,
                        rawSDL: contents,
                        document: parse(contents),
                    });
                }
            }

            const result = await codegen({
                schema: ctx.ast,
                filename: "",
                config: {},
                documents: _documents,
                plugins: [
                    { typescript: config },
                    { typescriptOperations: config },
                ],
                pluginMap: {
                    typescript: typescriptCodegen,
                    typescriptOperations: typescriptOperationsCodegen,
                },
            });

            sourceFile.addStatements(result);

            addTypePathImport(sourceFile, clientPath, "client");

            // combine all the operations into a single result so we can walk the AST
            // for them all at once
            const operations = _documents.map(({ document }) => document?.definitions ?? []).flat();
            for (const operation of operations) {
                if (operation.kind !== Kind.OPERATION_DEFINITION) continue;

                const operationName = operation.name?.value;
                if (!operationName) {
                    throw new Error("Operation name is required.");
                }

                console.log(operationName);
            }

            await project.save();
        },
    };
}