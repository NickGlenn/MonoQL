import { DocumentNode, parse, printSchema, concatAST } from "graphql";
import { loadSchema } from "@graphql-tools/load";
import { JsonFileLoader } from "@graphql-tools/json-file-loader";
import { UrlLoader } from "@graphql-tools/url-loader";
import { loadFiles } from "@graphql-tools/load-files";

export * from "./actions/writeSchema";
export * from "./actions/normalizeSchema";
export * from "./actions/flattenExtensionTypes";
export * from "./actions/implementMissingBaseDeclarations";
export * from "./actions/implementMissingInterfaceFields";
export * from "./actions/relayConnections";
export * from "./actions/runCodegen";
export * from "./actions/generateResolvers";
export * from "./actions/generateOperations";

export interface MonoQLConfig {
    /** Glob pattern pointing to the schema file(s) to use. */
    schema: string;
    /** When true, validation of input schema files will be skipped. */
    skipSchemaValidation?: boolean;
    /** A pipeline of actions to run. */
    pipeline: PipelineAction[];
};

/**
 * Defines a pipeline action that can be executed on a schema.
 */
export interface PipelineAction {
    /** The name of the action. */
    name: string;
    /** The function to execute. */
    execute(ctx: PipelineContext): void | Promise<void>;
}

/**
 * The context for a MonoQL pipeline. This is passed to each function found on a pipeline action.
 */
export interface PipelineContext {
    /** The schema files that were found and loaded. */
    readonly schemaSources: string | ReadonlyArray<string>;
    /** The pipeline actions that were provided in the configuration. */
    readonly pipelineActions: ReadonlyArray<PipelineAction>;
    /** The current action being executed. */
    readonly action: Readonly<PipelineAction>;
    /** The document node representing the schema. */
    ast: DocumentNode;
}

/**
 * Loads a schema and executes a series of actions on it or using it.
 */
export async function monoql({
    schema: schemaSrc,
    pipeline,
    skipSchemaValidation,
}: MonoQLConfig): Promise<void> {
    let ctxName = "Schema Loader";
    let currentAction: PipelineAction;

    try {

        process.stdout.write(`Loading schema... `);

        // if we're given a filepath, then let's load it using a "raw" loader
        // and manually stitch the schema together

        let ast: DocumentNode;

        // if we're given a URL or JSON file, then use the GraphQL tools to load it
        if (typeof schemaSrc === "string" && (schemaSrc.startsWith("http://") || schemaSrc.startsWith("https://") || schemaSrc.endsWith(".json"))) {
            const schema = await loadSchema(schemaSrc, {
                assumeValid: skipSchemaValidation,
                assumeValidSDL: skipSchemaValidation,
                includeSources: true,
                loaders: [
                    new UrlLoader(),
                    new JsonFileLoader(),
                ],
            });

            if (!schema.astNode) {
                throw new Error("The schema does not have a valid AST node.");
            }

            ast = parse(printSchema(schema));
        } else {
            const files = await loadFiles(schemaSrc, {});
            ast = concatAST(files);
        }

        console.log(blue("OK!"));

        // create the context object
        const ctx: PipelineContext = {
            schemaSources: schemaSrc,
            pipelineActions: pipeline,
            ast,
            get action() {
                return currentAction;
            },
        };

        // execute the pipeline actions
        for (const action of pipeline) {
            if (!action) continue;

            currentAction = action;
            ctxName = action.name;
            process.stdout.write(action.name + "... ");
            await action.execute(ctx);
            console.log(blue("OK!"));
        }

        console.log("Done!");

    } catch (err) {
        console.error(red("FAILED!"));
        console.error(err);
        process.exit(1);
    }
}


function red(str: string) {
    return `\u001b[31m${str}\u001b[39m`;
}

function blue(str: string) {
    return `\u001b[34m${str}\u001b[39m`;
}