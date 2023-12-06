import * as ts from "ts-morph";
import type { ConfigWithDefaults } from "./config";
import type { ISchemaDef, Schema } from "./Schema";
import { Kind, type DocumentNode } from "graphql";
import { readFileSync } from "fs";

/**
 * BuildCtx is an internal class that manages the state of the build process
 * and can provide shared functionality to the various schema types.
 */
export class BuildCtx {

    /** The user's configuration settings. */
    public readonly config: ConfigWithDefaults;

    /** The TypeScript project. */
    public readonly project: ts.Project;

    /** Primary source file where the generated code will be placed. */
    public readonly output: ts.SourceFile;

    /** All registered types in the schema. */
    public readonly types: Record<string, ISchemaDef>;

    /** AST of the generated GraphQL schema. */
    public readonly genAst: Mutable<DocumentNode>;

    /** AST of the user's custom GraphQL schema, if any. */
    public readonly userAst?: DocumentNode;

    /** Provides the lookup table used for creating aggregate queries. */
    public readonly objectInfo: ObjectInfoTable;

    /** Tracks prepared types. */
    private readonly prepared: ISchemaDef[] = [];

    constructor({ config, __types }: Schema) {
        const project = new ts.Project({ tsConfigFilePath: config.tsConfigPath });
        const baseline = readFileSync(__dirname + "/../templates/baseline.ts", "utf8");
        const output = project.createSourceFile(config.serverFileOutput, baseline, { overwrite: true });

        this.project = project;
        this.output = output;
        this.config = config;
        this.types = __types;
        this.genAst = {
            kind: Kind.DOCUMENT,
            definitions: [],
        };
        this.userAst = undefined;
        this.objectInfo = {};
    }

    /**
     * Prepares the given type unless it has already been prepared.
     */
    public prepare = (type: ISchemaDef): void => {
        if (!this.prepared.includes(type)) {
            type.__prepare(this);
            this.prepared.push(type);
        }
    }

}