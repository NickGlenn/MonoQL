![MonoQL](./logo.png)

> **Note:** This project is still in early development.

MonoQL is library that builds over top [The Guild's GraphQL Code Generation](https://the-guild.dev/graphql/codegen) tool and libraries.

In addition to type generation, it supports in-memory AST transformations, to allow for features like automatic generation of Relay-style connections or schema simplification.

### Features

- **GraphQL Codegen Compatibility** - MonoQL is designed to work with [The Guild's GraphQL Code Generation](https://the-guild.dev/graphql/codegen) eco system. This means that you can use any of the available plugins to generate code for your GraphQL server or client.
- **Schema normalization** - Performs automatic schema normalization to reduce boilerplate and improve developer experience. Normalization of schema includes:
  - Automatic implementation of missing interface fields for object types.
  - Automatic implementation of missing base definitions for object, interface, enum, union, and input types.
  - Automatic flattening of extension types into base types.
- **Relay Connection Generation** - Automatically generates Relay-style connections within your schema using the `@connection` directive.

## Getting Started

Install the monoql command line tool and library:

```shell
npm install -D monoql
```

Add the following to your `package.json` file:

```json
{
  "scripts": {
    "monoql": "monoql"
  }
}
```

Create a `monoql.config.ts` file in the root of your project and call the `monoql` function with your desired configuration.

Here's an example configuration:

```ts
import { monoql, normalizeSchema, relayConnections, writeSchema, generateResolvers, runCodegen } from "monoql";

monoql({
    // the path to your GraphQL schema files
    schema: "./schema/**/*.graphqls",
    // perform code generation
    pipeline: [

        // normalize the schema by flattening extensions, implementing missing interface fields,
        // implementing missing base definitions, and so on
        normalizeSchema(),

        // generate Relay-style connections for all object types that have the @connection directive
        relayConnections(),

        // save the resulting schema to a file location
        writeSchema({
            outputPath: "./schema.gen.graphqls",
        }),

        // preset for generating server types and resolvers
        generateResolvers({
            // where should resolver type definitions go?
            resolverTypesOutput: "./src/types/resolvers.gen.ts",
            // what approach should we use for scaffolding out resolvers by default?
            defaultScaffoldMode: "file",
            // where should scaffolded resolvers go?
            resolversOutputDir: "./src/resolvers",
        }),

        // execute a standard GraphQL Codegen pipeline
        runCodegen({
            // where should we save the generated client code?
            outputPath: "./src/lib/api.gen.ts",
            // where should we look for the operations?
            documents: "./queries/**/*.graphql",
            // plugins to use for code generation
            plugins: [],
            // configuration for the plugins
            config: {},
            // perform additional code generation to the result using ts-morph
            modifyTsOutput(sourceFile) {
                sourceFile.addStatements(`console.log("Hello World!");`);
            },
        }),

    ],
});
```