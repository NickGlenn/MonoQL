#!/usr/bin/env node

import * as path from "path";
import * as yargs from "yargs";
import Listr from "listr";
import { DocumentNode, print } from "graphql";
import { writeFile } from "fs/promises";
import { Mutable, parseSchema } from "./parser";
import { flattenExtensionTypes, implementMissingBaseDeclarations, implementMissingInterfaceFields } from "./process";
import { createConnectionTypes } from "./createConnectionTypes";
import { createResolverTypes } from "./createResolverTypes";
import { scaffoldResolvers } from "./scaffoldResolvers";

export interface PipelineContext {
    /** Directory where the schema files are located. */
    schemaDir: string;
    /** Directory where the generated files should be written. */
    outputDir: string;
    /** The parsed schema AST. */
    ast: Mutable<DocumentNode>;
};

(async function main() {

    const argv = await yargs
        .option("schema", {
            describe: "The path to the schema file(s) to use as input",
            type: "string",
            demandOption: true,
        })
        .option("output", {
            describe: "Path to where generated files should be written",
            type: "string",
            demandOption: true,
        })
        .help()
        .alias("help", "h").argv; ``

    return new Listr<PipelineContext>([
        {
            title: "Loading configuration",
            task: async (ctx) => {
                ctx.schemaDir = path.resolve(argv.schema);
                ctx.outputDir = path.resolve(argv.output);
            },
        }, {
            title: "Parsing schema",
            task: async (ctx) => {
                // load the schema files and parse them
                ctx.ast = parseSchema(ctx.schemaDir);
            },
        }, {
            title: "Implementing missing base definitions",
            // skip: (ctx) => ctx.config.preprocess?.implementMissingBaseDefinitions === false,
            task: (ctx) => implementMissingBaseDeclarations(ctx.ast),
        }, {
            title: "Flattening extension types",
            // skip: (ctx) => ctx.config.preprocess?.flattenExtensionTypes === false,
            task: (ctx) => flattenExtensionTypes(ctx.ast),
        }, {
            title: "Implementing missing interface fields",
            // skip: (ctx) => ctx.config.preprocess?.implementMissingInterfaceFields === false,
            task: (ctx) => implementMissingInterfaceFields(ctx.ast),
        }, {
            title: "Generating @connection types",
            // skip: (ctx) => !ctx.config.preprocess?.generateConnectionTypes,
            task: (ctx) => createConnectionTypes(ctx.ast),
        }, {
            title: "Generating server-side resolver types",
            task: (ctx) => createResolverTypes(ctx.ast, ctx.schemaDir, ctx.outputDir),
        }, {
            title: "Scaffolding resolvers",
            task: (ctx) => scaffoldResolvers(ctx.ast, ctx.schemaDir, ctx.outputDir),
        }, {
            title: "Exporting final schema",
            // skip: (ctx) => ctx.config.preprocess?.outputFile === false,
            task: async (ctx) => {
                const outputPath = path.join(ctx.outputDir, "schema.gen.graphqls");
                await writeFile(outputPath, print(ctx.ast as DocumentNode));
            },
        }
    ]).run();

})().catch((err) => {
    console.error(err);
    process.exit(1);
});