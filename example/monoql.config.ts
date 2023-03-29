import { runPipeline, generateRelayConnectionTypes, normalizeSchema, saveSchema } from "monoql";

runPipeline({
    schema: "schema/**/*.graphqls",
    pipeline: [
        normalizeSchema(),
        generateRelayConnectionTypes(),
        saveSchema({
            path: "schema.gen.graphqls",
        }),
    ],
});