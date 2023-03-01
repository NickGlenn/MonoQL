#!/usr/bin/env node

import * as path from "path";
import * as yargs from "yargs";
import { cosmiconfig } from "cosmiconfig";
import { Mutable, parseSchema } from "./parser";
import Listr from "listr";
import { TypeScriptLoader } from "cosmiconfig-typescript-loader";
import { DocumentNode, print } from "graphql";
import { flattenExtensionTypes, implementMissingBaseDeclarations, implementMissingInterfaceFields } from "./process";
import { validate } from "json-schema";
import { writeFile } from "fs/promises";
import { Config, mergeObjects } from "./config";
import { createConnectionTypes } from "./createConnectionTypes";
import { createResolverTypes } from "./createResolverTypes";

export interface PipelineContext {
    /** Directory of the configuration file. */
    configDir: string;
    /** The configuration file. */
    config: Config;
    /** The parsed schema AST. */
    ast: Mutable<DocumentNode>;
};

const tasks = new Listr<PipelineContext>([
    {
        title: "Loading configuration",
        task: async (ctx) => {
            const argv = await yargs
                .option("config", {
                    alias: "c",
                    describe: "Path to the configuration file",
                    type: "string",
                    demandOption: false,
                })
                .help()
                .alias("help", "h").argv;


            const moduleName = "moniql";
            const cc = cosmiconfig(moduleName, {
                searchPlaces: [
                    "package.json",
                    `.${moduleName}rc`,
                    `.${moduleName}rc.json`,
                    `.${moduleName}rc.yaml`,
                    `.${moduleName}rc.yml`,
                    `.${moduleName}rc.js`,
                    `.${moduleName}rc.ts`,
                    `.${moduleName}rc.cjs`,
                    `${moduleName}.config.js`,
                    `${moduleName}.config.ts`,
                    `${moduleName}.config.cjs`,
                ],
                loaders: {
                    ".ts": TypeScriptLoader(),
                },
            });

            // load the config file
            const configResult = await (argv.config
                ? cc.load(argv.config)
                : cc.search());

            // fail if the config file doesn't exist
            if (!configResult) {
                throw new Error("Configuration file not found");
            }

            // get the dirname of the config file
            const configDir = path.dirname(configResult.filepath ?? ".");

            // validate the configuration file
            const configSchema = require("../schema.json");
            // const defaultConfig = getDefaults(configSchema);
            // const config = mergeObjects(defaultConfig, configResult.config);
            const config = configResult.config;
            const res = validate(config, configSchema);

            if (!res.valid) {
                throw new Error(res.errors[0].message);
            }

            ctx.config = configResult.config;
            ctx.configDir = configDir;

            return configResult.filepath;
        },
    }, {
        title: "Parsing schema",
        task: async (ctx) => {
            // load the schema files and parse them
            ctx.ast = parseSchema(ctx.configDir, ctx.config.schema);
        },
    }, {
        title: "Implementing missing base definitions",
        skip: (ctx) => ctx.config.preprocess?.implementMissingBaseDefinitions === false,
        task: (ctx) => implementMissingBaseDeclarations(ctx.ast),
    }, {
        title: "Flattening extension types",
        skip: (ctx) => ctx.config.preprocess?.flattenExtensionTypes === false,
        task: (ctx) => flattenExtensionTypes(ctx.ast),
    }, {
        title: "Implementing missing interface fields",
        skip: (ctx) => ctx.config.preprocess?.implementMissingInterfaceFields === false,
        task: (ctx) => implementMissingInterfaceFields(ctx.ast),
    }, {
        title: "Generating @connection types",
        // skip: (ctx) => !ctx.config.preprocess?.generateConnectionTypes,
        task: (ctx) => createConnectionTypes(ctx.ast, ctx.config),
    }, {
        title: "Generating server-side resolver types",
        task: (ctx) => createResolverTypes(ctx.ast, ctx.config, ctx.configDir),
    }, {
        title: "Exporting final schema",
        skip: (ctx) => ctx.config.preprocess?.outputFile === false,
        task: async (ctx) => {
            // make the path relative to the config file unless it's an absolute path
            let outputPath = "./schema.gen.graphqls";
            if (ctx.config.preprocess?.outputFile) {
                outputPath = ctx.config.preprocess.outputFile;
            }

            if (!path.isAbsolute(outputPath)) {
                outputPath = path.join(ctx.configDir, outputPath);
            }

            await writeFile(outputPath, print(ctx.ast as DocumentNode));
        },
    }
]);


tasks.run().catch((err) => {
    console.error(err);
    process.exit(1);
});