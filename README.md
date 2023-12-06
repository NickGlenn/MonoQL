![MonoQL](./logo.png)

MonoQL is a code-as-configuration, generative framework for creating GraphQL backends over MongoDB. MonoQL aims to reduce the separation and friction that typically exists between your application frontend(s) and the backend by allowing you to define your GraphQL schema and backend code in the same place, effectively exposing your database to your clients.

> :construction_worker: This project is under heavy development and is currently employing some temporary stop gaps as we continue to build out the core functionality.

- [x] Automatic generation of queries for models with...
  - [x] opt-in pagination
  - [x] sorting
  - [x] filtering
- [ ] Translates your GraphQL query requests into MongoDB operations using the aggregation pipeline
- [ ] Supports MongoDB transactions for mutations
- [ ] Generates a type-safe ODM for interacting with your models directly
- [ ] Opt-in audit/revision system for all model types
- [x] Specify indexes and unique constraints on your models from your schema
- [ ] Supports multi-tenant relationships
- [ ] Supports a hook-in authentication system
- [x] Provides several built-in scalar types

## Getting Started

> :under_construction: This command is not yet available.

To start the setup wizard to create a new MonoQL project or add MonoQL to an existing project, run the following command:

```
npm create monoql@latest
```

This will walk you through the setup process for creating a new MonoQL project or adding MonoQL to an existing project. Once you've completed the setup wizard, you can use the `monoql` command to generate your MonoQL application code.

## Defining Your Schema

MonoQL uses a `monoql.config.ts` file to define the schema and rules of your application. The first step is to create your `schema` object. This object is used to define your GraphQL schema and the models that make up your application. The value passed to the `createSchema` function is an object that defines the global configuration for your generated application code.

At the end of your `monoql.config.ts` file, you must call the `schema.generate()` function to generate your GraphQL schema and application code. This function will return a `Promise` that resolves when the generation process is complete.


```ts
import { createSchema } from "monoql";

const schema = createSchema({
    outDir: "./src/monoql",
});

// define your types

schema.generate();
```

## Models

The core of MonoQL is the `model` type. Models map to documents and collections in your MongoDB database. Models accept a variety of configuration properties that allow you to define the schema and rules of your application's data layer.

```ts
const User = schema.model({
    name: "User",
    docs: "An authenticated entity in the system",
    fields: {
        name: {
            docs: "Display name of the user",
            type: types.String,
        },
        avatarUrl: {
            docs: "URL of the user's avatar",
            type: types.URL,
        },
        email: {
            docs: "The user's email address",
            type: types.Email,
            unique: true,
        },
        password: {
            docs: "Hashed password of the user",
            type: types.String,
            internal: true,
        },
    },
});
```

## Interfaces

Interfaces allow you to define a set of rules that can be applied to multiple models. Interfaces can be used to define common fields, relationships, and more. Interfaces can be marked as `abstract` to prevent them from appearing directly in your API, operating more like a "base class" in traditional object-oriented programming.

```ts
const Timestamps = schema.interface({
    name: "Timestamps",
    abstract: true,
    fields: {
        createdAt: {
            docs: "Date/time the object was created",
            type: types.DateTime,
            readonly: true,
            sortable: true,
            default: { $exec: "new Date()" },
        },
        updatedAt: {
            docs: "Date/time the object was last updated",
            type: types.DateTime,
            readonly: true,
            sortable: true,
            default: { $exec: "new Date()" },
            onUpdate: { $exec: "new Date()" },
        },
    },
});

const User = schema.model({
    name: "User",
    implements: [Timestamps],
    // ...
});
```

## TODO...