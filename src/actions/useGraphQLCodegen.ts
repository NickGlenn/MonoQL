import { codegen } from "@graphql-codegen/core";
import type { Types } from "@graphql-codegen/plugin-helpers";
import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
import type { PipelineAction } from "../core";

export type UseGraphQLCodegenOptions = Omit<Types.GenerateOptions, "schema">;

/**
 * Allows the Guild's GraphQL codegen ecosystem to be used within a MonoQL pipeline.
 */
export function useGraphQLCodegen(config: UseGraphQLCodegenOptions): PipelineAction {
    return {
        name: "GraphQL Codegen",
        async execute(ctx) {
            const result = await codegen({
                ...config,
                schema: ctx.ast,
            });

            await mkdir(dirname(config.filename), { recursive: true });

            await writeFile(config.filename, result, "utf8");
        },
    }
}