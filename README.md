![MonoQL](./logo.png)

MonoQL is a tool (and toolkit) for quickly creating type-safe GraphQL servers and clients, specifically using Typescript. It's similar to (and utilizes) [The Guild's GraphQL Code Generation](https://the-guild.dev/graphql/codegen) eco-system, but with 2 key differences:

1. MonoQL favors a programmatic "code as configuration" approach. This makes it easier to control, customize, and extend the tool to fit your needs without the need of creating a custom plugin.
1. MonoQL actions can (and often do) modify the AST in memory during execution. This allows for features like automatic generation of Relay-style connections or schema simplification. MonoQL is also able to re-export the modified AST as GraphQL SDL, which can be used by other tools.

MonoQL is completely compatible with plugins from GraphQL codegen eco-system, provided you use the `useGuildCodegen()` action. This allows you to use the best of both worlds.

### Planned Features

> These are not promises, but rather goals if time permits.

- Proper documentation website.
- Automatic resolver generation for common use cases (e.g. CRUD operations).
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

Create a `monoql.config.ts` file in the root of your project that invokes the `runPipeline()` function. This will load your schema files into an aggregated AST and then pipe it through a series of actions. These actions can modify the AST, generate code, and so on.

A list of bundled actions can be found in the [Actions](#actions) section. You can also create your own action by implementing the `PipelineAction` interface provided by MonoQL.

```ts
import { runPipeline, normalizeSchema, saveSchema } from "monoql";

runPipeline({
  schema: "./schema/**/*.graphqls",
  pipeline: [
    normalizeSchema(),
    saveSchema({
      path: "./schema.gen.graphqls",
    }),
  ],
});
```

## Actions

### `normalizeSchema`

It is _highly_ recommended that you use this action as the first action in your pipeline. This action is actually an aggregate of a few other actions and is offered as a convenience.

The actions that are executed are as a part of this action are:

- [`implementMissingBaseDeclarations`](#implementmissingbasedeclarations)
- [`flattenExtensionTypes`](#flattenextensiontypes)
- [`implementMissingInterfaceFields`](#implementmissinginterfacefields)

```ts
import { runPipeline, normalizeSchema } from "monoql";

runPipeline({
  schema: "./schema/**/*.graphqls",
  pipeline: [
    normalizeSchema({
      implementMissingBaseDeclarations: false, // disables this step
      flattenExtensionTypes: { // overrides the default options for this step
        mergeDocs: false, // disables merging docs from extension types
      },
    }),
  ],
});
```

### `implementMissingBaseDeclarations`

> **Note:** This action is included by the `normalizeSchema()` action.

This action will create any missing base definitions for object, interface, enum, union, and input types. This is useful for schemas that use extension types to add fields to existing types.

```ts
import { runPipeline, normalizeSchema } from "monoql";

runPipeline({
  schema: "./schema/**/*.graphqls",
  pipeline: [
    implementMissingBaseDeclarations(),
  ],
});
```

For example, the following schema would be INVALID because the `User` type is extended, but lacks a base definition:

```graphql
extend type User {
  email: String!
}

extend type User {
  phone: String!
}
```

Using this action, the schema would be normalized to the following:

```graphql
type User

extend type User {
  email: String!
}

extend type User {
  phone: String!
}
```

### `flattenExtensionTypes`

> **Note:** This action is included by the `normalizeSchema()` action.

Automatically merges extension types down into flattened base types. This is useful for schemas that use extension types to add fields to existing types.

```ts
import { runPipeline, normalizeSchema } from "monoql";

runPipeline({
  schema: "./schema/**/*.graphqls",
  pipeline: [
    flattenExtensionTypes({
      mergeDocs: true,
    }),
  ],
});
```

> **Note:** The default behavior for documentation is to use base type's documentation if it exists. If no documentation exists on the base type, then the documentation from all extension types will be merged together in the order they are encountered. You can disable this behavior by setting the `mergeDocs` option to `false`.

For example, the following schema:

```graphql
"Represents a user"
type User

extend type User {
  email: String!
}

extend type User {
  phone: String!
}
```

Will be flattened into:

```graphql
"Represents a user"
type User {
  email: String!
  phone: String!
}
```

### `implementMissingInterfaceFields`

> **Note:** This action is included by the `normalizeSchema()` action.

This action will automatically implement any missing interface fields for object types. This is useful for schemas that use extension types to add fields to existing types or simply to reduce the amount of redundant/boilerplate code.

```ts
import { runPipeline, normalizeSchema } from "monoql";

runPipeline({
  schema: "./schema/**/*.graphqls",
  pipeline: [
    implementMissingInterfaceFields(),
  ],
});
```

For example, the following schema would be INVALID because the `User` type is missing the `id` field:

```graphql
interface Node {
  id: ID!
}

type User implements Node {
  email: String!
}
```

Using this action, the schema would be normalized to the following:

```graphql
interface Node {
  id: ID!
}

type User implements Node {
  id: ID!
  email: String!
}
```

### `saveSchema`

Saves the current state of the AST as a GraphQL SDL file. This can be useful for a variety of reasons, such as debugging or for using your schema in other tools.

```ts
import { runPipeline, saveSchema } from "monoql";

runPipeline({
  schema: "./schema/**/*.graphqls",
  pipeline: [
    saveSchema({
      path: "./schema.gen.graphqls",
    }),
  ],
});
```

### `generateRelayConnectionTypes`

Generates missing Relay-style connection types for all fields that use a `@connection` directive. The `@connection` directive requires requires a `for` argument that contains a string with the name of another type in the schema. This function will generate a connection type for that type.

```ts
import { runPipeline, generateRelayConnectionTypes } from "monoql";

runPipeline({
  schema: "./schema/**/*.graphqls",
  pipeline: [
    generateRelayConnectionTypes({
      createPageInfoIfMissing: true,
      pageArgs: { first: true, after: true },
      pageInfo: {
        hasNextPage: true,
        hasPreviousPage: true,
        startCursor: true,
        endCursor: true,
        totalCount: true,
      },
    }),
  ],
});
```

If an "Edge" type is defined and set as the `via` argument of the `@connection` directive, then the generated connection type will use that type to populate the "edges" field.

The "PageInfo" type will also be created automatically if missing, along with any common missing fields, but this can be customized using the `pageInfo` option.

Additionally, the `pageArgs` provides a list of arguments that will be added to the connection field (if missing). By default, only the `"first"` and `"after"` arguments are enabled.


### `generateTypescriptResolverTypes`

Generates Typescript types that can be used when implementing resolvers for your schema (most commonly, for a GraphQL server).

```ts
import { runPipeline, generateTypescriptResolverTypes } from "monoql";

runPipeline({
  schema: "./schema/**/*.graphqls",
  pipeline: [
    generateTypescriptResolverTypes({
      path: "./src/types/resolvers.gen.ts",
    }),
  ],
});
```

### `scaffoldResolvers`

> **Note:** This action requires the `generateTypescriptResolverTypes` action to be executed first.

Scaffolds out the basic structure of your resolvers. This is useful for getting started with your resolvers or for quickly adding new resolvers to your schema without having to write the boilerplate code.

```ts
import { runPipeline, scaffoldResolvers } from "monoql";

runPipeline({
  schema: "./schema/**/*.graphqls",
  pipeline: [
    generateTypescriptResolverTypes({
      path: "./src/types/resolvers.gen.ts",
    }),
    scaffoldResolvers({
      path: "./src/resolvers",
      typesPath: "./src/types/resolvers.gen.ts",
      defaultResolution: "file",
    }),
  ],
});
```

By default, this will generate resolver files for all types in your schema that have any fields with one or more arguments. You can disable this behavior by setting the `defaultResolution` to `none`. Additionally, you can use the `@resolver` directive to manually specify resolver behavior for a type.

When using the `file` resolver (which is the default), this action will generate a resolver file in the `resolvers/` directory that outputs a constant with the name of the type. For example, if you have a type named `User`, this action will generate a file named `resolvers/User.ts` that contains the following:

```typescript
// resolvers/User.ts
import { UserResolver } from "../generated/resolvers.gen";

export const User: UserResolver = {
  // ...
}
```

The `directory` resolver will generate a folder of individual resolver files for each resolved field. This is particularly useful for types like `Query` and `Mutation` that have a large number of fields, all of which typically have their own resolver. In the example below, we explicitly mark the `Query` and `Mutation` types as `@resolver(type: DIRECTORY)`.

```graphql
type Query @resolver(type: DIRECTORY) {
  user(id: ID!): User
}

type Mutation @resolver(type: DIRECTORY) {
  createUser(input: CreateUserInput!): User
}
```

This will generate the following files:

```text
resolvers/
  Query/
    Query.ts
    user.ts
  Mutation/
    Mutation.ts
    createUser.ts
```