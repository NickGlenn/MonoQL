import { z } from "zod";

export const configSchema = z.object({
    schema: z.string(),
    outputDir: z.string().default("./src/moniql"),
    outputFinalSchema: z.string().optional(),
    implementMissingBaseDefinitions: z.boolean().default(true),
    flattenExtensionTypes: z.boolean().default(true),
    implementMissingInterfaceFields: z.boolean().default(true),
    scaffoldResolvers: z.enum(["none", "files", "object"]).default("files"),
    resolversDir: z.string().default("./src/moniql/resolvers"),
});

export type CliConfig = z.infer<typeof configSchema>;
