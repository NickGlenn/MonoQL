import glob from "glob";
import { DocumentNode, parse } from "graphql";
import { readFile } from "node:fs/promises";

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
    readonly schemaFiles: ReadonlyArray<string>;
    /** The pipeline actions that were provided in the configuration. */
    readonly pipelineActions: ReadonlyArray<PipelineAction>;
    /** The current action being executed. */
    readonly action: Readonly<PipelineAction>;
    /** The current state of the schema AST. */
    ast: DocumentNode;
}

/**
 * Internal function that loads a schema and executes a series of transformations
 * and actions on it. This is used by the `createServer` and `createClient` functions.
 */
export async function runPipeline(schemaGlob: string, actions: PipelineAction[]): Promise<void> {
    let ctxName = "Schema Loader";
    let currentAction: PipelineAction;

    try {

        const schemaFiles = glob.sync(schemaGlob, {
            absolute: true,
        });

        if (schemaFiles.length === 0) {
            throw new Error(`No schema files were found using the glob pattern "${schemaGlob}" in directory "${process.cwd()}".`);
        }

        // load all the schema files and merge them into a single string
        let schema = "";

        for (const file of schemaFiles) {
            schema += await readFile(file, "utf8") + "\n";
        }

        if (schema.trim().length === 0) {
            throw new Error(`The schema files found using the glob pattern "${schemaGlob}" in directory "${process.cwd()}" were empty.`);
        }

        // parse the schema
        const ast = parse(schema);

        // create the context object
        const ctx: PipelineContext = {
            schemaFiles,
            pipelineActions: actions,
            ast,
            get action() {
                return currentAction;
            },
        };

        // execute the pipeline actions
        for (const action of actions) {
            if (!action) continue;

            currentAction = action;
            ctxName = action.name;
            await action.execute(ctx);
        }

    } catch (err) {
        const message = typeof err === "string" ? err : (err as Error).message;

        // create a string of 80 `-` characters
        console.error(red(("-- " + ctxName + " ") + "-".repeat(76 - ctxName.length)));

        // print the error message, but ensure that each line is only 80 characters and not
        // split in the middle of a word
        const words = message.split(" ");
        let line = "";
        for (const word of words) {
            if (line.length + word.length > 80) {
                console.error(line);
                line = "";
            }
            line += word + " ";
        }
        if (line) {
            console.error(line);
        }

        process.exit(1);
    }
}


function red(str: string) {
    return `\u001b[31m${str}\u001b[39m`;
}
