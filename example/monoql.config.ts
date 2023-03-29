import { runPipeline, generateRelayConnectionTypes, normalizeSchema, saveSchema, generateTypescriptResolverTypes, generateApolloClientOperations } from "monoql";

runPipeline({
    schema: "schema/**/*.graphqls",
    pipeline: [
        normalizeSchema(),
        generateRelayConnectionTypes(),
        generateTypescriptResolverTypes({
            path: "types/resolvers.gen.ts",
        }),
        generateApolloClientOperations({
            path: "client.gen.ts",
            apolloClientPath: "./client",
            documents: "query/**/*.graphql",
            dedupeOperationSuffix: true,
            omitOperationSuffix: true,
        }),
        saveSchema({
            path: "schema.gen.graphqls",
        }),
    ],
});