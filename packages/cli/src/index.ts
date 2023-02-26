import * as fs from "fs";
import * as path from "path";
import * as yargs from "yargs";
import * as yaml from "yaml";
import { z } from "zod";
import { parseSchema } from "./parser";
import { Generator } from "./generate";

const configSchema = z.object({
    schema: z.object({
        input: z.string(),
        output: z.string().default("./schema.gen.graphqls"),
    }),
    serverOutput: z.string().default("./server.gen.ts"),
});

export type CliConfig = z.infer<typeof configSchema>;

(async function () {

    const argv = await yargs
        .option("config", {
            alias: "c",
            describe: "Path to the configuration file",
            type: "string",
            demandOption: true,
        })
        .help()
        .alias("help", "h").argv;

    let configFilePath = path.resolve(argv.config);
    // if the config file path is a directory, then assume the default config file name
    if (fs.statSync(configFilePath).isDirectory()) {
        configFilePath = path.join(configFilePath, "moniql.yml");
    }

    // get the dirname of the config file
    const configDir = path.dirname(configFilePath);

    // load the configuration file and parse it using YAML
    const content = fs.readFileSync(configFilePath, "utf8");
    if (!fs.existsSync(configFilePath)) {
        throw new Error(`File not found: ${configFilePath}`);
    }

    const configRaw = yaml.parse(content);

    // validate the configuration file
    const result = configSchema.safeParse(configRaw);
    if (!result.success) {
        throw new Error(result.error.toString());
    }

    const config = result.data;

    // load the schema files and parse them
    const ast = parseSchema(configDir, config.schema.input);

    // generate the code
    const { graphqlSchema, tsCode } = new Generator(ast);

    // write the generated code to the output file - this should relative to the
    // config file unless it's an absolute path
    const serverOutputPath = path.isAbsolute(config.serverOutput)
        ? config.serverOutput
        : path.join(configDir, config.serverOutput);
    fs.writeFileSync(serverOutputPath, tsCode);

    // write the generated schema to the output file - this should relative to the
    // config file unless it's an absolute path
    const schemaOutputPath = path.isAbsolute(config.schema.output)
        ? config.schema.output
        : path.join(configDir, config.schema.output);
    fs.writeFileSync(schemaOutputPath, graphqlSchema);
})();