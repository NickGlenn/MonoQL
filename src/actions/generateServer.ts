import { codegen } from "@graphql-codegen/core";
import * as typescriptCodegen from "@graphql-codegen/typescript";
import * as typescriptResolversCodegen from "@graphql-codegen/typescript-resolvers";
import type { TypeScriptPluginConfig } from "@graphql-codegen/typescript";
import type { TypeScriptResolversPluginConfig } from "@graphql-codegen/typescript-resolvers";
import { Project } from "ts-morph";
import type { PipelineAction } from "../index";

export type GenerateServerConfig = {
    /** Determines what server formula to use. */
    // TODO: add support for other frameworks
    server: "generic";
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
 * Generates server code from a GraphQL schema.
 */
export function generateServer({
    server,
    resolverTypesOutput,
    resolversOutputDir,
    defaultScaffoldMode = "file",
    ...config
}: GenerateServerConfig): PipelineAction {
    return {
        name: "Generate Server",
        async execute(ctx) {
            const project = new Project();

            // (re)create the resolver types file
            const resolverTypesFile = project.createSourceFile(resolverTypesOutput, "", { overwrite: true });

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

            resolverTypesFile.addStatements(result);

            // TODO: scaffold resolvers

            await project.save();
        },
    };
}