#!/usr/bin/env node

import * as path from "path";
import * as yargs from "yargs";
import { cosmiconfig } from "cosmiconfig";
import { Mutable, parseSchema } from "./parser";
import { Generator } from "./generate";
import Listr from "listr";
import { TypeScriptLoader } from "cosmiconfig-typescript-loader";
import { DocumentNode, print } from "graphql";
import { flattenExtensionTypes, implementMissingBaseDeclarations, implementMissingInterfaceFields } from "./process";
import { CliConfig, configSchema } from "./config";
import { writeFile } from "fs/promises";

export interface PipelineContext {
    /** Directory of the configuration file. */
    configDir: string;
    /** The configuration file. */
    config: CliConfig;
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
            const result = configSchema.safeParse(configResult.config);
            if (!result.success) {
                throw new Error(result.error.toString());
            }

            const config = result.data;

            ctx.config = config;
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
        skip: (ctx) => !ctx.config.implementMissingBaseDefinitions,
        task: (ctx) => implementMissingBaseDeclarations(ctx.ast),
    }, {
        title: "Flattening extension types",
        skip: (ctx) => !ctx.config.flattenExtensionTypes,
        task: (ctx) => flattenExtensionTypes(ctx.ast),
    }, {
        title: "Implementing missing interface fields",
        skip: (ctx) => !ctx.config.implementMissingInterfaceFields,
        task: (ctx) => implementMissingInterfaceFields(ctx.ast),
    }, {
        title: "Executing pipeline",
        task: async (ctx, task) => {
            const pipeline = new Listr<PipelineContext>();

            // TODO: create a task for each plugin specified in the config file

            // pipeline.add({
            //     title: "Generating code for MongoDB",
            //     task(ctx, task) {
            //         return new Promise((resolve, reject) => {
            //             setTimeout(() => {
            //                 resolve(null);
            //             }, 5000);
            //         });
            //     },
            // });

            // pipeline.add({
            //     title: "Create Resolvers",
            //     task(ctx, task) {
            //         return new Promise((resolve, reject) => {
            //             setTimeout(() => {
            //                 resolve(null);
            //             }, 5000);
            //         });
            //     },
            // });

            return pipeline;
        },
    }, {
        title: "Exporting final schema",
        skip: (ctx) => !ctx.config.outputFinalSchema,
        task: async (ctx) => {
            // make the path relative to the config file unless it's an absolute path
            const outputPath = path.isAbsolute(ctx.config.outputFinalSchema!)
                ? ctx.config.outputFinalSchema!
                : path.join(ctx.configDir, ctx.config.outputFinalSchema!);

            await writeFile(outputPath, print(ctx.ast as DocumentNode));
        },
    }
]);



tasks.run().catch((err) => {
    // console.error(err);
    process.exit(1);
});



// (async function () {





//     // load the schema files and parse them
//     const ast = parseSchema(configDir, config.schema.input);

//     // generate the code
//     const { graphqlSchema, tsCode } = new Generator(ast);

//     // write the generated code to the output file - this should relative to the
//     // config file unless it's an absolute path
//     const serverOutputPath = path.isAbsolute(config.serverOutput)
//         ? config.serverOutput
//         : path.join(configDir, config.serverOutput);
//     fs.writeFileSync(serverOutputPath, tsCode);

//     // write the generated schema to the output file - this should relative to the
//     // config file unless it's an absolute path
//     const schemaOutputPath = path.isAbsolute(config.schema.output)
//         ? config.schema.output
//         : path.join(configDir, config.schema.output);
//     fs.writeFileSync(schemaOutputPath, graphqlSchema);
// })();