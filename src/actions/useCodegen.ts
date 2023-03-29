import { codegen } from "@graphql-codegen/core";
import type { Types } from "@graphql-codegen/plugin-helpers";
import type { PipelineAction } from "../core";

export type UseCodegenOptions = Omit<Types.GenerateOptions, "schema">;

/**
 * Allows the Guild's GraphQL codegen ecosystem to be used by MonoQL.
 */
export function useCodegen(config: UseCodegenOptions): PipelineAction {
    return {
        name: "GraphQL Codegen",
        async execute(ctx) {
            await codegen({
                ...config,
                schema: ctx.ast,
            });
        },
    }
}