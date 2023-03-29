import { writeFile } from "fs/promises";
import { print } from "graphql";
import type { PipelineAction } from "../core";

export interface SaveSchemaOptions {
    /** Where to save the schema to, relative to the current working directory. */
    path: string;
}

/**
 * Outputs the current state of the GraphQL AST back to disk as a single SDL file. This
 * allows you to use the transformed AST as a standard GraphQL schema file that can be used by other
 * tools.
 */
export function saveSchema({ path }: SaveSchemaOptions): PipelineAction {
    return {
        name: "Save Schema",
        async validate(ctx) {
            // TODO: validate path
        },
        async execute(ctx) {
            await writeFile(path, print(ctx.ast));
        },
    };
}