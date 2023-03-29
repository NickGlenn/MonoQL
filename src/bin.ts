#!/usr/bin/env node

import * as path from "node:path";
import * as yargs from "yargs";

(async function main() {

    (global as any).crypto = require("crypto");

    const argv = await yargs
        .option("config", {
            describe: "Points to the configuration file to use",
            type: "string",
            default: "./monoql.config.ts",
        })
        .help()
        .alias("help", "h").argv;

    // attempt to load and execute the config file
    const configPath = path.resolve(process.cwd(), argv.config);

    const { esrun } = await import("@digitak/esrun");

    await esrun(configPath, {
        exitAfterExecution: true,
        tsConfigFile: path.resolve(__dirname, "../tsconfig.bundled.json"),
    });

})().catch((err) => {
    console.error(`Failed to execute MonoQL pipeline: ${err.message}`);
    process.exit(1);
});