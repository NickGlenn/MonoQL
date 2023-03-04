![MonoQL](./logo.png)

MonoQL is command line tool that helps with the creation of GraphQL servers using Typescript and NodeJS/Deno. It's similar to GraphQL code generator's `typescript-resolver` plugin, but unlike GraphQL codegen, MonoQL is able to modify the resulting AST and provides a variety of directives that can be used to customize the generated code.

## Features

- Generate server-side Typescript types for GraphQL schema's objects and resolvers
- Customize how resolvers are generated using directives
- Automatically generate DBOs (Data-Base Objects) for each object type in the schema using the `@dbo` directive
- Automatically generate Relay-style connections for each object type in the schema using the `@connection` directive
- Merges extension types down into flattened types
- Automatically implements missing interface fields

## Getting Started

Install the monoql command line tool:

```bash
npm install monoql
```

And add a script to your `package.json` file:

```json
{
  "scripts": {
    "monoql": "monoql --schema ./schema/**/*.graphql --output ./src/generated"
  }
}
```

This will execute the command line tool using the schema files in the `schema` directory and output the generated files to the `src/generated` directory.

## CLI Options

TODO

## Directives

TODO