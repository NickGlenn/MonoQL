import { join } from "path";

/** Defines the global configuration settings for MonoQL. */
export interface Config {
    /** The output directory for the generated code. */
    outDir?: string;
    /** Where to load existing GraphQL schema files from, if any. */
    schemaPath?: string;
    /** 
     * Where to put the generated GraphQL schema file. If not specified,
     * it will be placed in the schemaPath directory. If schemaPath is not
     * specified, it will be placed in the outDir directory. In either case,
     * the file will be named "monoql.gen.graphqls".
     */
    schemaOutput?: string;
    /** 
     * Where to explicitly write the MonoQL application code to. If not specified,
     * it will be placed in the outDir directory as "monoql.gen.ts".
     */
    serverFileOutput?: string;
    /** The path to the Typescript configuration file. */
    tsConfigPath?: string;
    /** 
     * Defines the rules of pagination for the generated queries. Defaults to classic
     * pagination with a page and perPage argument.
     */
    pagination?: PaginationConfig | OffsetPaginationConfig | CursorPaginationConfig;
    /** The type definition for the GraphQL context object provided to resolvers. */
    contextType?: string;
    /** Key on the context object where the user's authentication data is stored. */
    authContextKey?: string;
    /** 
     * Key on the context object where the database access object is stored. If not set,
     * this will default to "db". This is a required part of the MonoQL API and MUST be
     * present on the context object.
     */
    databaseContextKey?: string;
}

/** 
 * Classic pagination where the user specifies the page number and the
 * number of items per page. Provides page and perPage arguments.
 */
interface PaginationConfig {
    /** Determines what type of pagination to use. */
    type: "page";
    /** Key to use for the page number argument. Defaults to "page". */
    pageArgName?: string;
    /** Key to use for the page size argument. Defaults to "perPage". */
    perPageArgName?: string;
    /** The default page size to use if none is specified. Defaults to 25. */
    defaultPageSize?: number;
    /** The maximum page size to allow, if enforced. */
    maxPageSize?: number;
}

/**
 * Offset-based pagination where the user specifies the number of items
 * to skip and the number of items to return. Maps more closely to how
 * databases work. Provides skip and limit arguments.
 */
interface OffsetPaginationConfig {
    /** Determines what type of pagination to use. */
    type: "offset";
    /** Key to use for the skip argument. Defaults to "skip". */
    skipArgName?: string;
    /** Key to use for the limit argument. Defaults to "limit". */
    limitArgName?: string;
    /** The default limit to use if none is specified. Defaults to 25. */
    defaultLimit?: number;
    /** The maximum limit to allow, if enforced. */
    maxLimit?: number;
}

/**
 * Cursor-based pagination where the user specifies a cursor and the
 * number of items to return. This is the most efficient type of
 * pagination, but requires that the user's data be sortable. Provides
 * first, last, before, and after arguments.
 */
interface CursorPaginationConfig {
    /** Determines what type of pagination to use. */
    type: "cursor";
}


/**
 * Applies default values to the given configuration object, producing a
 * final configuration that will be carried through the generation pipeline.
 */
export function applyDefaults({
    outDir = "./src/monoql",
    databaseContextKey = "db",
    schemaOutput,
    serverFileOutput,
    pagination = { type: "page", defaultPageSize: 25 },
    ...config
}: Config) {
    if (!schemaOutput) {
        if (config.schemaPath) {
            schemaOutput = join(config.schemaPath, "monoql.gen.graphqls");
        } else {
            schemaOutput = join(outDir, "monoql.gen.graphqls");
        }
    }

    if (!serverFileOutput) {
        serverFileOutput = join(outDir, "monoql.gen.ts");
    }

    switch (pagination.type) {
        case "cursor":
            break;
        case "offset":
            pagination = {
                defaultLimit: 25,
                skipArgName: "skip",
                limitArgName: "limit",
                ...pagination,
            };
            break;
        case "page":
            pagination = {
                defaultPageSize: 25,
                pageArgName: "page",
                perPageArgName: "perPage",
                ...pagination,
            };
            break;
    }

    return {
        ...config,
        outDir,
        schemaOutput,
        serverFileOutput,
        databaseContextKey,
        pagination,
    };
}


/** Final configuration settings after applying defaults. */
export type ConfigWithDefaults = ReturnType<typeof applyDefaults>;