import { codegen } from "@graphql-codegen/core";
import type { CodegenPlugin, Types } from "@graphql-codegen/plugin-helpers";
import { ClientSideBaseVisitor, LoadedFragment } from "@graphql-codegen/visitor-plugin-common";
import * as typescriptCodegen from "@graphql-codegen/typescript";
import * as typescriptOperationsCodegen from "@graphql-codegen/typescript-operations";
import type { TypeScriptPluginConfig } from "@graphql-codegen/typescript";
import { Project, SourceFile } from "ts-morph";
import type { PipelineAction, PipelineContext } from "../index";
import { TypeScriptDocumentsPluginConfig } from "@graphql-codegen/typescript-operations";
import { CodeFileLoader } from "@graphql-tools/code-file-loader";
import { GraphQLFileLoader } from "@graphql-tools/graphql-file-loader";
import { JsonFileLoader } from "@graphql-tools/json-file-loader";
import { loadDocuments } from "@graphql-tools/load";
import { DocumentNode, Kind, concatAST, visit } from "graphql";

export type GenerateOperationsOptions = {
    /** The output path for the generated code. */
    outputPath: string;
    /** Glob pattern to use when searching for documents. */
    documents: string;
    /** When true, the used operation fragments will be injected into the generated code. */
    injectFragments?: boolean;
    // /** Skip validation of the documents. */
    // skipDocumentsValidation?: Types.SkipDocumentsValidationOptions;
    /**
     * When present, the generated code will be parsed with TS morph and the
     * resulting file contents will be passed to this function for further processing
     * and modification.
     */
    modifyTsOutput?(ctx: ModifyTSOperationsOutputContext): void | Promise<void>;
}
    & TypeScriptPluginConfig
    & TypeScriptDocumentsPluginConfig;


export interface ModifyTSOperationsOutputContext extends PipelineContext {
    /** The source file that was generated. */
    sourceFile: SourceFile;
    /** The documents that were loaded. */
    documents: Types.DocumentFile[];
    /** Combined AST of all documents. */
    documentsAst: DocumentNode;
}

/**
 * Preset for generating Typescript types and operation/fragment types.
 */
export function generateOperations({
    outputPath,
    documents: documentsGlob,
    injectFragments = true,
    modifyTsOutput,
    ...config
}: GenerateOperationsOptions): PipelineAction {
    return {
        name: "Generate Operations",
        async execute(ctx) {
            config = {
                useTypeImports: true,
                dedupeOperationSuffix: true,
                dedupeFragments: true,
                ...config,
            };

            // create the documents list from the given glob
            const documents = await loadDocuments(documentsGlob, {
                loaders: [
                    new CodeFileLoader(),
                    new JsonFileLoader(),
                    new GraphQLFileLoader(),
                ],
            });

            const plugins: Record<string, any>[] = [
                { typescript: config },
                { typescriptResolvers: config },
            ];

            if (injectFragments) {
                plugins.push({ injectFragments: {} });
            }


            let result = await codegen({
                schema: ctx.ast,
                documents,
                config,
                filename: outputPath,
                plugins: plugins,
                pluginMap: {
                    typescript: typescriptCodegen,
                    typescriptResolvers: typescriptOperationsCodegen,
                    injectFragments: _injectFragments,
                },
            });

            const project = new Project();
            const sourceFile = project.createSourceFile(outputPath, result, { overwrite: true });

            if (modifyTsOutput) {
                await modifyTsOutput({
                    ...ctx,
                    sourceFile,
                    documents,
                    documentsAst: concatAST(documents.map((d) => d.document!)),
                });
            }

            await sourceFile.save();
        },
    };
}


const _injectFragments: CodegenPlugin = {
    plugin(schema, documents, config) {
        // combine the fragments into a single allFragments document
        const allAst = concatAST(documents.map((d) => d.document!));

        const allFragments: LoadedFragment[] = [];
        for (const def of allAst.definitions) {
            if (def.kind === Kind.FRAGMENT_DEFINITION) {
                allFragments.push({
                    node: def,
                    name: def.name.value,
                    onType: def.typeCondition.name.value,
                    isExternal: false,
                });
            }
        }

        const visitor = new ClientSideBaseVisitor(
            schema,
            allFragments,
            {},
            { documentVariableSuffix: "Doc" },
            documents
        );

        const visitorResult = visit(allAst, visitor);

        const imports = `import gql from "graphql-tag";`;
        const content = visitorResult.definitions.filter(d => typeof d === "string").join("\n");

        return { content, prepend: [imports] };
    },
};