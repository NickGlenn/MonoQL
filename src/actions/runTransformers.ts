import { TransformSchemaFn } from "../index";
import { PipelineAction } from "../runner";

/**
 * Creates a new pipeline action that executes the given set of transform functions.
 */
export function runTransformers(transformers: TransformSchemaFn | TransformSchemaFn[]): PipelineAction {
    return {
        name: "Transform Schema",
        async execute(ctx) {
            const transforms = Array.isArray(transformers) ? transformers : [transformers];
            for (const transform of transforms) {
                ctx.ast = await transform(ctx.ast);
            }
        },
    };
}