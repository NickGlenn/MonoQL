import { codegen } from "@graphql-codegen/core";
import type { CodegenPlugin, Types } from "@graphql-codegen/plugin-helpers";
import { writeFile } from "node:fs/promises";
import { Project, SourceFile } from "ts-morph";
import type { PipelineAction, PipelineContext } from "../index";
import { loadDocuments } from "@graphql-tools/load";
import { CodeFileLoader } from "@graphql-tools/code-file-loader";
import { GraphQLFileLoader } from "@graphql-tools/graphql-file-loader";
import { JsonFileLoader } from "@graphql-tools/json-file-loader";


export interface CodegenConfig {
    /** The output path for the generated code. */
    outputPath: string;
    /** Glob pattern to use when searching for documents. */
    documents: string;
    /** List of plugins to use. */
    plugins: CodegenPlugin[];
    /** Configuration to pass to the plugins. */
    config: Record<string, any>;
    /** Skip validation of the documents. */
    skipDocumentsValidation?: Types.SkipDocumentsValidationOptions;
    /**
     * When present, the generated code will be parsed with TS morph and the
     * resulting file contents will be passed to this function for further processing
     * and modification.
     */
    modifyTsOutput?(ctx: ModifyTSOutputContext): void | Promise<void>;
}

export interface ModifyTSOutputContext extends PipelineContext {
    /** The source file that was generated. */
    sourceFile: SourceFile;
    /** The documents that were loaded. */
    documents: Types.DocumentFile[];
}

/**
 * Executes code generation using GraphQL Code Generator.
 */
export function runCodegen({
    outputPath,
    documents: documentsGlob,
    plugins,
    config,
    skipDocumentsValidation,
    modifyTsOutput,
}: CodegenConfig): PipelineAction {
    return {
        name: "Run Codegen",
        async execute(ctx) {
            // create the documents list from the given glob
            const documents = await loadDocuments(documentsGlob, {
                loaders: [
                    new CodeFileLoader(),
                    new JsonFileLoader(),
                    new GraphQLFileLoader(),
                ],
            });

            const pluginMap: Record<string, CodegenPlugin> = {};
            for (let i = 0; i < plugins.length; i++) {
                pluginMap["plugin_" + i] = plugins[i];
            }

            const result = await codegen({
                schema: ctx.ast,
                documents,
                filename: outputPath,
                plugins: plugins.map((p, i) => ({ ["plugin_" + i]: config })),
                pluginMap,
                config,
                skipDocumentsValidation,
            });

            if (modifyTsOutput) {
                const project = new Project();
                const sourceFile = project.createSourceFile(outputPath, result, { overwrite: true });
                await modifyTsOutput({
                    ...ctx,
                    sourceFile,
                    documents,
                });
                await sourceFile.save();
            } else {
                await writeFile(outputPath, result);
            }
        },
    };
}