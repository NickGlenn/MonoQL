import { type DocumentNode, Kind, print } from "graphql";
import { EnumDef } from "./EnumDef";
import { InterfaceDef } from "./InterfaceDef";
import { ModelDef } from "./ModelDef";
import { ScalarDef } from "./ScalarDef";
import { applyDefaults, type Config, type ConfigWithDefaults } from "./config";
import * as types from "./scalars";
import { jsify, renderTemplate } from "./utils";
import * as ts from "ts-morph";
import { mkdir, writeFile } from "fs/promises";
import { ObjectDef } from "./ObjectDef";
import { generateApiTypes } from "./gql2ts";
import { BuildCtx } from "./BuildCtx";


const reservedNames = [
    "Query",
    "Mutation",
    "Subscription",
];

/**
 * The root factory for a MonoQL schema.
 */
export class Schema {

    /**
     * The configuration settings for the schema. These can be used to customize
     * the behavior of the schema and the generated code.
     */
    public readonly config: ConfigWithDefaults;

    /** Generated type definitions for the schema. */
    public readonly __types: Record<string, ISchemaDef> = {};

    constructor(config: Config) {
        this.config = applyDefaults(config);

        for (const scalar of Object.values(types)) {
            this.__types[scalar.name] = scalar;
        }

        // TODO: parse the user's schema if present

        // create the Query and Mutation object types
        this.__types["Query"] = new ObjectDef("Query", "Root query type.");
        this.__types["Mutation"] = new ObjectDef("Mutation", "Root mutation type.");

        const dir = this.__types["SortDirection"] = new EnumDef("SortDirection", "The direction to sort a field.");
        dir.value({ name: "ASC", desc: "Sorts in ascending order." });
        dir.value({ name: "DESC", desc: "Sorts in descending order." });

        const pageInfo = this.__types["PageInfo"] = new ObjectDef("PageInfo", "Information about the current page of results.");
        pageInfo.field({
            name: "hasNextPage",
            type: types.Boolean,
            desc: "Whether or not there are more results after this page.",
        });
        pageInfo.field({
            name: "hasPreviousPage",
            type: types.Boolean,
            desc: "Whether or not there are more results before this page.",
        });
        if (this.config.pagination.type === "cursor") {
            pageInfo.field({
                name: "startCursor",
                type: types.String,
                desc: "The cursor to use for the start of the next page.",
            });
            pageInfo.field({
                name: "endCursor",
                type: types.String,
                desc: "The cursor to use for the end of the previous page.",
            });
        }
        pageInfo.field({
            name: "total",
            type: types.Uint,
            desc: "The total number of results across all pages.",
        });
    }

    /** Ensures the given type name can be used. */
    private checkName(name: string) {
        if (reservedNames.includes(name)) {
            throw new Error(`The name "${name}" is reserved and cannot be used.`);
        }

        if (this.__types[name]) {
            throw new Error(`Type "${name}" already exists in the schema.`);
        }
    }

    /**
     * Defines a new scalar or primitive type. Scalars are used to represent the
     * most basic types in your application, such as strings and numbers. In cases
     * where you don't need to conform as aggressively to a specific type, you can
     * use a scalar to represent the data. For example, you might use a scalar to
     * represent a date or time, or a JSON object. Scalars can also be used for more 
     * complex purposes as well, like validation of email addresses.
     */
    public scalar(config: {
        /** The name of the scalar. */
        name: string;
        /** The Typescript type of the scalar. */
        tsType: string;
        /** Description of the scalar. */
        desc?: string;
    }) {
        this.checkName(config.name);
        const o = this.__types[config.name] = new ScalarDef(config.name, config.tsType, config.desc);
        return o as Public<ScalarDef>;
    }

    /**
     * Defines a new model in the schema. Models directly map to top-level objects
     * stored within collections in your MongoDB database. Each model has a set of
     * fields that define the shape of the object, and a set of methods that can
     * be used to interact with the object.
     */
    public model(config: {
        /** The name of the model. */
        name: string;
        /** Description of the model. */
        desc?: string;
        /** The name of the collection in the database. */
        collection?: string;
    }) {
        this.checkName(config.name);
        const o = this.__types[config.name] = new ModelDef(this, config.name, config.desc, config.collection);
        return o as Public<ModelDef>;
    }

    // /**
    //  * Defines a generic object type that can be used as a part of a model or other
    //  * object. Objects can be shared my multiple parent types, but are never stored
    //  * directly at the top level of the database.
    //  */
    // object,

    /**
     * Define a set of common fields and rules that can be shared by multiple models.
     * Additionally, interfaces can be made non-abstract to produce an interface that is
     * exposed in your API and can be used for creating queries/mutations that work with
     * multiple models.
     */
    public interface(config: {
        /** The name of the interface. */
        name: string;
        /** Description of the interface. */
        desc?: string;
        /** Whether or not the interface is abstract. */
        abstract?: boolean;
    }) {
        this.checkName(config.name);
        const o = this.__types[config.name] = new InterfaceDef(config.name, config.desc, config.abstract);
        return o as Public<InterfaceDef>;
    }

    // /**
    //  * Defines a union type that can be used to represent multiple types in a single
    //  * field. This is useful when you need to represent a field that can be one of
    //  * multiple types, such as a field that can be a string or a number.
    //  */
    // union,

    /**
     * Defines a new enumeration type. Enumerations are used to represent a set of
     * possible values for a field. For example, you might use an enumeration to
     * represent the possible statuses of a user account.
     */
    public enum(i: {
        /** The name of the enumeration type. */
        name: string;
        /** Description of the enumeration type. */
        desc?: string;
    }) {
        this.checkName(i.name);
        const o = this.__types[i.name] = new EnumDef(i.name, i.desc);
        return o as Public<EnumDef>;
    }

    // /**
    //  * Defines a new mutation that can be performed via the API. This allows for free-form
    //  * mutations that can be used to perform any type of operation on the database. Mutations
    //  * can be used to create, update, or delete objects, or perform other operations.
    //  */
    // public mutation(i: {
    //     /** The name of the mutation. */
    //     name: string;
    //     /** Description of the mutation. */
    //     desc?: string;
    // }) {
    //     this.checkName(i.name);
    //     // TODO: find the Mutation object and add it as a mutation field
    //     // const o = this.types[i.name] = new MutationDef(i.name, i.desc);
    //     return o as Public<MutationDef>;
    // }

    /**
     * Performs code generation and creates the necessary files for your application.
     */
    public async generate() {
        const ctx = new BuildCtx(this);

        // prepare each type
        for (const type of Object.values(ctx.types)) {
            ctx.prepare(type);
        }

        // create the API schema using the 2 schemas
        for (const type of Object.values(ctx.types)) {
            type.__generateApi(ctx);
        }

        // now that we have the schema's, let's generate the GraphQL API types
        generateApiTypes(ctx);

        // build each type instance
        for (const type of Object.values(ctx.types)) {
            await type.__generateImpl(ctx);
        }

        // write the query lookup table to the output file
        ctx.output.addVariableStatement({
            declarationKind: ts.VariableDeclarationKind.Const,
            declarations: [{
                name: "objectInfo",
                initializer: jsify(ctx.objectInfo),
            }],
        });

        ctx.output.insertText(0, "// This file is generated by MonoQL. Do not edit.\n\n");
        ctx.output.formatText();

        await mkdir(this.config.outDir, { recursive: true });
        await ctx.output.save();
        await writeFile(this.config.schemaOutput,
            "# This file is generated by MonoQL. Do not edit.\n\n"
            + print(ctx.genAst as DocumentNode)
        );

        console.log("Generated MonoQL files");
    }

}

/**
 * Base type for all MonoQL schema types.
 */
export interface ISchemaDef {

    /** Called before any generation occurs. Allows for type expansion. */
    __prepare(ctx: BuildCtx): void;

    /** Generates the API schema for this type. */
    __generateApi(ctx: BuildCtx): void;

    /** Performs any build operations needed for this schema type. */
    __generateImpl(ctx: BuildCtx): void | Promise<void>;

}

/**
 * Strips internal fields that need to be public within the MonoQL
 * API, but we don't want to expose to the end user.
 */
export type Public<T extends ISchemaDef> = Omit<T, "__prepare" | "__generateApi" | "__generateImpl">;


/**
 * Version of Schema without internal fields.
 */
export type PublicSchema = Omit<Schema, "types">;