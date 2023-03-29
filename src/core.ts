import glob from "glob";
import { DocumentNode, parse } from "graphql";
import { readFileSync } from "node:fs";
import { Mutable } from "./types";

/**
 * The configuration for the MonoQL CLI.
 */
export interface MonoQLConfig {
    /** The path to the schema file(s) to use as input. Supports glob patterns. */
    schema: string;
    /** The series of transformers to apply to the schema AST. */
    pipeline: PipelineAction[];
}

/**
 * Represents a MonoQL transformer that can be applied to the schema AST.
 */
export interface PipelineAction<State = void> {
    /** The name of the action. */
    name: string;
    /**
     * Allows the action to validate the configuration, check the environment, evaluate
     * the pipeline for dependencies, and perform any other setup tasks that need to happen
     * BEFORE the execute function is called.
     */
    validate?(ctx: PipelineContext): void | Promise<void>;
    /**
     * Allows the action to modify the schema AST, generate files, or perform any other
     * tasks that need to happen within the pipeline.
     */
    execute(ctx: PipelineContext): State | Promise<State>;
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
    // /** Resulting state for each action that has been executed. */
    // readonly state: Readonly<Record<string, unknown>>;
}

/**
 * Executes a MonoQL pipeline using the provided configuration.
 */
export async function runPipeline({
    schema: schemaGlob,
    pipeline,
}: MonoQLConfig): Promise<void> {
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
            schema += readFileSync(file, "utf8") + "\n";
        }

        if (schema.trim().length === 0) {
            throw new Error(`The schema files found using the glob pattern "${schemaGlob}" in directory "${process.cwd()}" were empty.`);
        }

        // parse the schema
        const ast = parse(schema)

        // create the context object
        const ctx: PipelineContext = {
            schemaFiles,
            pipelineActions: pipeline,
            ast,
            get action() {
                return currentAction;
            },
        };

        for (const action of pipeline) {
            currentAction = action;

            if (!action.name) {
                ctxName = "Invalid Action Configuration";
                throw new Error(`Pipeline action is missing a name. If you are the author of this action, please add a "name" property to the action. Otherwise, you may need to get in touch with the author of the action.`);
            }

            if (action.validate) {
                ctxName = "Validation Error: " + action.name;
                await action.validate(ctx);
            }
        }

        for (const action of pipeline) {
            currentAction = action;
            ctxName = "Execution Error: " + action.name;
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


function blue(str: string) {
    return `\u001b[34m${str}\u001b[39m`;
}

function red(str: string) {
    return `\u001b[31m${str}\u001b[39m`;
}
