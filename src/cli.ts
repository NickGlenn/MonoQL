import * as yargs from "yargs";
import { join, resolve } from "path";
import { red } from "./utils";
import { existsSync } from "fs";
import { ConfigError } from "./error";

(async () => {

    const { esrun } = await import("@digitak/esrun");
    const argv = await yargs
        .option("config", {
            describe: "Points to the configuration file to use, when empty it will search for a monoql.config.ts file in the current directory and its parents",
            type: "string",
            default: "",
            alias: "c",
        })
        .version()
        .help()
        .alias("help", "h")
        .argv;

    let configPath = argv.config;
    if (!configPath) {
        const rootPath = process.platform === "win32" ? process.cwd().split("\\")[0] : "/";
        let searchPath = process.cwd();

        while (searchPath !== rootPath) {
            const candidate = join(searchPath, "monoql.config.ts");

            if (existsSync(candidate)) {
                configPath = candidate;
                break;
            }

            searchPath = join(searchPath, "..");
        }

        if (!configPath) {
            throw new Error(`Failed to find "monoql.config.ts" file.`);
        }
    } else {
        configPath = resolve(configPath);
        if (!existsSync(configPath)) {
            throw new Error(`Failed to find "${configPath}" file.`);
        }
    }

    try {
        await esrun(configPath, {
            exitAfterExecution: true,
            // tsConfigFile: join(__dirname, "..", "tsconfig.json"),
        });
    } catch (err) {
        throw new ConfigError((err as Error), {
            configPath,
            line: 0,
            column: 0,
        });
    }

})().catch((err) => {
    const headerSize = 80;

    if (err instanceof ConfigError) {
        const prefix = "Config Error";
        const suffix = err.info.configPath + (err.info.line ? `:${err.info.line}:${err.info.column}` : "")
        const spacers = headerSize - (prefix.length + 1) + (suffix.length + 1);

        console.log(red(`${prefix} ${"=".repeat(spacers)} ${suffix}`));
        console.error("\n");
        console.error(red(err.message));
        console.error("\n");
    } else {
        console.log(red(`Error ${"=".repeat(headerSize - 6)}`));
        console.error("\n");
        console.error(red(err.stack));
        console.error("\n");
    }

    process.exit(1);
});
