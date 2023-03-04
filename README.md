![MonoQL](./logo.png)

MonoQL is command line tool that helps with the creation of Typescript GraphQL servers for NodeJS/Deno. It's similar to GraphQL code generator's `typescript-resolver` plugin, but unlike GraphQL codegen, MonoQL is able to modify the resulting AST as it's processing the schema and its directives. This allows for automatic generation of things like Relay-style connections.

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

## Features

### Basic Type Generation

MonoQL can generate Typescript types for your GraphQL schema. It will generate a `types.gen.ts` file that contains all of the types for your schema. It will also generate supporting types for scalars, resolvers, and so on.

### Resolver Scaffolding

```bash
--resolver-default none | file | directory
```

By default, MonoQL will generate resolver files for all types in your schema that have any fields with one or more arguments. You can disable this behavior by setting the `--resolver-default` to `none`. Alternatively, you can use the `@resolver` directive to manually specify resolver behavior for a type.

When using the `file` resolver (which is the default), MonoQL will generate a resolver file in the `resolvers/` directory that outputs a constant with the name of the type. For example, if you have a type named `User`, MonoQL will generate a file named `resolvers/user.ts` that contains the following:

```typescript
// resolvers/User.ts
export const User: UserResolver = {
  // ...
}
```

The `directory` resolver will generate a folder of individual resolver files for each resolved field. This is particularly useful for types like `Query` and `Mutation` that have a large number of fields, all of which require their own resolver. In the example below, we explicitly mark the `Query` and `Mutation` types as `@resolver(type: DIRECTORY)`.

```graphql
type Query @resolver(type: DIRECTORY) {
  user(id: ID!): User
}

type Mutation @resolver(type: DIRECTORY) {
  createUser(input: CreateUserInput!): User
}
```

## Flatten Extension Types

Automatically merges extension types down into flattened base types. This is useful for schemas that use extension types to add fields to existing types. Disable the feature by providing the `--no-flatten-extensions` flag.

For example, the following schema:

```graphql
extend type User {
  email: String!
}

extend type User {
  phone: String!
}
```

Will be flattened into:

```graphql
type User {
  email: String!
  phone: String!
}
```