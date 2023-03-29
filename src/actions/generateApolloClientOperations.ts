import { codegen } from "@graphql-codegen/core";
import { Project } from "ts-morph";
import { PipelineAction } from "../core";

import type { Types } from "@graphql-codegen/plugin-helpers";
import * as typescriptCodegen from "@graphql-codegen/typescript";
import * as typescriptOperationsCodegen from "@graphql-codegen/typescript-operations";
import type { TypeScriptPluginConfig } from "@graphql-codegen/typescript";
import type { TypeScriptDocumentsPluginConfig } from "@graphql-codegen/typescript-operations";
import type { TypePath } from "../types";
import { addTypePathImport } from "../internal";
import { glob } from "glob";
import { readFile } from "fs/promises";
import { parse } from "graphql";

export type GenerateApolloClientOperationsOptions = {
    /** The path to the generated file. */
    path: string;
    /** Path to where the Apollo client is created, relative to the location of the `path` file. */
    apolloClientPath: TypePath;
    /** Glob pattern for the GraphQL documents to include. */
    documents: string | string[];
}
    & TypeScriptPluginConfig
    & TypeScriptDocumentsPluginConfig;

/**
 * Generates the types, operation types, and typed helper functions for a set of
 * GraphQL query and mutation operations.
 */
export function generateApolloClientOperations({
    path,
    apolloClientPath,
    documents,
    ...config
}: GenerateApolloClientOperationsOptions): PipelineAction {
    return {
        name: "Apollo Client Operations",
        async execute(ctx) {
            const project = new Project();

            const sourceFile = project.createSourceFile(path, undefined, {
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
                filename: path,
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

            addTypePathImport(sourceFile, apolloClientPath, "apolloClient");

            // add each operation and fragment to the resulting file
            for (const { document } of _documents) {
                // TODO:
            }

            await project.save();
        },
    };
}