import { codegen } from "@graphql-codegen/core";
import type { CodegenPlugin, Types } from "@graphql-codegen/plugin-helpers";
import { readFile, writeFile } from "node:fs/promises";
import { Project, SourceFile } from "ts-morph";
import type { PipelineAction, PipelineContext } from "../index";
import { glob } from "glob";
import { parse } from "graphql";

export interface CodegenConfig<T extends object> {
    /** The output path for the generated code. */
    outputPath: string;
    /** Glob pattern to use when searching for documents. */
    documents: string | string[];
    /** List of plugins to use. */
    plugins: CodegenPlugin[];
    /** Configuration to pass to the plugins. */
    config: T;
    /**
     * When present, the generated code will be parsed with TS morph and the
     * resulting file contents will be passed to this function for further processing
     * and modification.
     */
    modifyTsOutput?(sourceFile: SourceFile, ctx: PipelineContext): void | Promise<void>;
}

/**
 * Executes code generation using GraphQL Code Generator.
 */
export function runCodegen<T extends object>({
    outputPath,
    documents: documentsGlob,
    plugins,
    config,
    modifyTsOutput,
}: CodegenConfig<T>): PipelineAction {
    return {
        name: "Run Codegen",
        async execute(ctx) {
            // create the documents list from the given glob
            const documents: Types.DocumentFile[] = [];

            for (const docglob of documentsGlob) {
                const files = glob.sync(docglob, { absolute: true });

                for (const file of files) {
                    const contents = await readFile(file, "utf-8");
                    documents.push({
                        document: parse(contents),
                        location: file,
                        rawSDL: contents,
                    });
                }
            }

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
            });

            if (modifyTsOutput) {
                const project = new Project();
                const sourcefile = project.createSourceFile(outputPath, result, { overwrite: true });

                await modifyTsOutput(sourcefile, ctx);

                await sourcefile.save();
            } else {
                await writeFile(outputPath, result);
            }
        },
    };
}