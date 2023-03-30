import { monoql } from "monoql";

monoql({
    // the path to your GraphQL schema files
    schema: "./schema/**/*.graphqls",
    // modify the GraphQL schema in-memory before code generation
    transformSchema(ast) {
        return ast;
    },
    // perform code generation
    // (this can be an object if you have a single desired output)
    generates: [
        {
            // save the resulting schema to a file location
            schema: "./schema.gen.graphqls",
        },
        {
            // generate an Apollo client
            client: "apollo",
            // where should we look for the operations?
            documents: "./queries/**/*.graphql",
            // where is the Apollo client code being created?
            clientPath: "./src/lib/api#client",
            // add custom bindings for using the client with Svelte
            framework: "svelte",
            // where should we save the generated client code?
            clientOutput: "./src/lib/api.gen.ts",
            // should the operation type be suffixed to the resulting types and functions?
            omitOperationSuffix: false,
        },
        {
            // create supporting types and resolvers for a generic GraphQL server
            server: "generic",
            // where should resolver type definitions go?
            resolverTypesOutput: "./src/types/resolvers.gen.ts",
            // where should resolvers go?
            resolversOutputDir: "./src/resolvers",
            // what approach should we use for scaffolding out resolvers by default?
            defaultScaffoldMode: "file",
        },
    ],
});