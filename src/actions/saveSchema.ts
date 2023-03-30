import { mkdir, writeFile } from "fs/promises";
import { print } from "graphql";
import { dirname } from "path";
import type { PipelineAction } from "../runner";

/**
 * Outputs the current state of the GraphQL AST back to disk as a single SDL file. This
 * allows you to use the transformed AST as a standard GraphQL schema file that can be used by other
 * tools.
 */
export function saveSchema(path: string): PipelineAction {
    return {
        name: "Save Schema",
        async execute(ctx) {
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, print(ctx.ast));
        },
    };
}