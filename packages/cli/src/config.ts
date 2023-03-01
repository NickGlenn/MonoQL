// import { z } from "zod";

/** Configuration for a Moniql project. */
export interface Config {
    /**
     * The path to the schema file(s).
     */
    schema: string;
    /**
     * Schema pre-processing settings.
     */
    preprocess?: {
        /**
         * Implement missing base definitions for extended types. This allows types to
         * be defined in a distributed manner across multiple files.
         *
         * @default true
         */
        implementMissingBaseDefinitions: boolean;
        /**
         * Flattens all extension types down into a single type definition.
         *
         * @default true
         */
        flattenExtensionTypes: boolean;
        /**
         * Implement missing interface fields for types that implement an interface.
         *
         * @default true
         */
        implementMissingInterfaceFields: boolean;
        /**
         * Output the final GraphQL schema after pre-processing to the specified
         * file path (relative to the config file).
         *
         * @default "./schema.gen.graphqls"
         */
        outputFile?: false | string;
    };
    /** Settings for resolver generation. */
    resolvers?: {
        /** The directory to output resolver files to. */
        outputDir?: string;
        /**
         * Determines how resolvers are output by default.
         *
         * @default "file"
         */
        format?: "none" | "file" | "directory";
        /**
         * Overrides the default resolver format for specific types.
         *
         * @default { Query: "directory", Mutation: "directory" }
         */
        overrides?: { [key: string]: "none" | "file" | "directory" };
    };
}


// export const configSchema = z.object({
//     schema: z.string(),
//     outputDir: z.string().default("./src/moniql"),
//     outputFinalSchema: z.string().optional(),
//     implementMissingBaseDefinitions: z.boolean().default(true),
//     flattenExtensionTypes: z.boolean().default(true),
//     implementMissingInterfaceFields: z.boolean().default(true),
//     scaffoldResolvers: z.enum(["none", "files", "object"]).default("files"),
//     // resolver generation settings
//     resolvers: z.object({
//         outputDir: z.string().default("./src/moniql/resolvers"),
//         format: z.enum(["none", "file", "directory"]).default("file"),
//         overrides: z.map(z.enum(["none", "files", "object"])).default({
//             Query: "directory",
//             Mutation: "directory",
//         })
//     }),
// });

// export type CliConfig = z.infer<typeof configSchema>;


interface DefaultObject {
    [key: string]: any;
}

export function extractDefaults(obj: any, defaults: DefaultObject = {}): DefaultObject {
    if (typeof obj !== "object" || obj === null) {
        return defaults;
    }

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            extractDefaults(obj[i], defaults);
        }
    } else {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (key === "default") {
                    defaults[value] = true;
                } else {
                    extractDefaults(value, defaults);
                }
            }
        }
    }

    return defaults;
}

/**
 * Recursively merges two objects.
 */
export function mergeObjects<T>(obj1: T, obj2: T): T {
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
        return obj2;
    } else if (typeof obj1 === "object" && typeof obj2 === "object" && obj1 !== null && obj2 !== null) {
        const obj: { [key: string]: any } = {};
        for (const [key, value] of Object.entries(obj1)) {
            obj[key] = mergeObjects(value, (obj2 as any)[key]);
        }
        for (const [key, value] of Object.entries(obj2)) {
            if (!obj.hasOwnProperty(key)) {
                obj[key] = value;
            }
        }
        return obj as any;
    } else {
        return obj2;
    }
}