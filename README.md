![MonoQL](./logo.png)

> **Note:** This project is still in early development.

MonoQL is an opinionated generative "framework" for quickly creating type-safe GraphQL servers and clients using Typescript. It's built over top [The Guild's GraphQL Code Generation](https://the-guild.dev/graphql/codegen) and supports in-memory AST transformations (to allow for features like automatic generation of Relay-style connections or schema simplification) and code scaffolding in addition to GraphQL codegen's existing type-generation capabilities.

### Features

- **Fully type-safe** - MonoQL uses Typescript to generate type-safe code for your GraphQL server and client.
- **Minimal boilerplate** - MonoQL generates all of the boilerplate code for you, including type definitions, resolvers, and client queries/mutations.
- **Minimal configuration** - MonoQL is designed to work out of the box with minimal configuration. Simply point it at your schema and it will generate the appropriate code for you.
- **Schema normalization** - Performs automatic schema normalization to reduce boilerplate and improve developer experience. Normalization of schema includes:
  - Automatic implementation of missing interface fields for object types.
  - Automatic implementation of missing base definitions for object, interface, enum, union, and input types.
  - Automatic flattening of extension types into base types.
- **Relay Connection Generation** - Automatically generates Relay-style connections within your schema using the `@connection` directive.
- **Single install, multiple frameworks** - MonoQL is designed to work with any GraphQL client or server framework. Simply choose the preset that best fits your needs and MonoQL will generate the appropriate code for you.

### Planned Features

> These are not promises, but rather things I'd like to do if time permits.

- Proper documentation (and documentation website).
- Automatic resolver generation for common use cases (e.g. CRUD operations) so you can generate a fully functional GraphQL server purely from your schema.
- Tools for generating database objects directly from the GraphQL schema to allow for automatic database integration.

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

Create a `monoql.config.ts` file in the root of your project and call the `monoql` function with your desired configuration. This will generate the appropriate code for your project and can be used to generate a server, client, or both.

Here's an example configuration that generates a server, client, and schema using a handful of the available options:

```ts
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
```