import { mkdir, writeFile } from "fs/promises";
import { print } from "graphql";
import { dirname } from "path";
import type { PipelineAction } from "../index";

export interface WriteSchemaOptions {
    /** Path to the output file. */
    outputPath: string;
}

/**
 * Outputs the current state of the GraphQL AST back to disk as a single SDL file. This
 * allows you to use the transformed AST as a standard GraphQL schema file that can be used by other
 * tools.
 */
export function writeSchema({ outputPath }: WriteSchemaOptions): PipelineAction {
    return {
        name: "Write Schema",
        async execute(ctx) {
            await mkdir(dirname(outputPath), { recursive: true });
            await writeFile(outputPath, print(ctx.ast));
        },
    };
}