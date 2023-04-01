import { codegen } from "@graphql-codegen/core";
import * as typescriptCodegen from "@graphql-codegen/typescript";
import * as typescriptResolversCodegen from "@graphql-codegen/typescript-resolvers";
import type { TypeScriptPluginConfig } from "@graphql-codegen/typescript";
import type { TypeScriptResolversPluginConfig } from "@graphql-codegen/typescript-resolvers";
import { Project } from "ts-morph";
import type { PipelineAction } from "../index";

export type GenerateResolversOptions = {
    /** Output path for the generated resolver types. */
    resolverTypesOutput: string;
    /** Output path for the scaffolded resolvers. If not provided, scaffolding will be skipped. */
    resolversOutputDir?: string;
    /** Default mode used when scaffolding resolvers. */
    defaultScaffoldMode?: "none" | "file" | "directory";
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

            // (re)create the resolver types file
            const resolverTypesFile = project.createSourceFile(resolverTypesOutput, result, { overwrite: true });

            resolverTypesFile.addStatements(result);

            // TODO: scaffold resolvers

            await project.save();
        },
    };
}