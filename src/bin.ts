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
    /** Default resolver scaffolding behavior. */
    resolverDefault: "none" | "file" | "directory";
    /** Is extension merging enabled? */
    skipFlattenExtensionTypes: boolean;
    /** Determines what arguments to add to connection type fields. */
    connectionArgs: string[];
    /** Should a totalCount field be added to connection types? */
    addTotalCountToPageInfo: boolean;
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
        .option("resolver-default", {
            describe: "Default resolver scaffolding behavior",
            type: "string",
            choices: ["none", "file", "directory"],
            default: "file",
        })
        .option("no-extension-merging", {
            describe: "Disable merging of extension types into their base types",
            type: "boolean",
            default: false,
        })
        // TODO: support offset pagination in addition to cursor connections
        .option("connection-args", {
            describe: "Determines what arguments to add to connection type fields",
            type: "array",
            choices: ["first", "last", "before", "after"],
            default: ["first", "after"],
        })
        .option("add-total-count-to-page-info", {
            describe: "Should a totalCount field be added to generated PageInfo type?",
            type: "boolean",
            default: false,
        })
        .help()
        .alias("help", "h").argv;

    return new Listr<PipelineContext>([
        {
            title: "Parsing schema",
            task: async (ctx) => {
                ctx.schemaDir = path.resolve(argv.schema);
                ctx.outputDir = path.resolve(argv.output);
                ctx.resolverDefault = argv["resolver-default"] as "none" | "file" | "directory";
                ctx.skipFlattenExtensionTypes = argv["no-extension-merging"];
                ctx.connectionArgs = argv["connection-args"];
                ctx.addTotalCountToPageInfo = argv["add-total-count-to-page-info"];

                // load the schema files and parse them
                ctx.ast = parseSchema(ctx.schemaDir);
            },
        }, {
            title: "Implementing missing base definitions",
            // skip: (ctx) => ctx.config.preprocess?.implementMissingBaseDefinitions === false,
            task: implementMissingBaseDeclarations,
        }, {
            title: "Flattening extension types",
            skip: (ctx) => ctx.skipFlattenExtensionTypes,
            task: flattenExtensionTypes,
        }, {
            title: "Implementing missing interface fields",
            // skip: (ctx) => ctx.config.preprocess?.implementMissingInterfaceFields === false,
            task: implementMissingInterfaceFields,
        }, {
            title: "Generating @connection types",
            // skip: (ctx) => !ctx.config.preprocess?.generateConnectionTypes,
            task: createConnectionTypes,
        }, {
            title: "Generating server-side resolver types",
            task: createResolverTypes,
        }, {
            title: "Scaffolding resolvers",
            task: scaffoldResolvers,
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