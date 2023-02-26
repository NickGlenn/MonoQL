# Moniql

Moniql is tool for creating GraphQL servers with an automatic MongoDB backend. The goal is to create a solution for building complex applications quickly, using GraphQL schema definition files to do the heavy lifting. The project is built using Typescript and provides a command line tool for generating a GraphQL server.

## Getting Started

Install the moniql command line tool and supporting library:

```bash
npm install moniql
```

Create a `moniql.yml` file in the root of your project. This file will contain the configuration for your server. Point the `schema` property to the path of your GraphQL schema file(s). The schema file should be a valid GraphQL schema definition file. The `schema` property can also be a glob pattern, which will be used to match multiple schema files.

```yaml
schema: ./schema/**/*.graphql
```