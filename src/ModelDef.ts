import pluralize from "pluralize";
import { camel } from "case";
import { ObjectBaseDef } from "./ObjectBaseDef";
import type { IndexDescription } from "mongodb";
import * as types from "./scalars";
import { type ModelQueryFieldConfig, ModelQueryFieldDef } from "./ModelQueryDef";
import type { IBaseType } from "./Types";
import type { Schema } from "./Schema";
import type { ObjectDef } from "./ObjectDef";
import { EnumDef } from "./EnumDef";


/**
 * Defines a new database object type, or "model". This is a top level object
 * that is stored directly in the database within a collection (either its own
 * or a shared collection).
 */
export class ModelDef extends ObjectBaseDef implements IBaseType {

    /** The name of the collection in the database. */
    public readonly collection: string;

    /** Indexes that have been defined for the model (and its collection). */
    public readonly indexes: IndexDescription[] = [];

    constructor(
        /** The schema the model belongs to. */
        private readonly __schema: Schema,
        /** The name of the scalar type. */
        name: string,
        /** Description of the scalar type. */
        desc?: string,
        /** The name of the collection in the database. */
        collection?: string,
    ) {
        super(name, desc);
        this.collection = collection || pluralize(camel(name));

        this.field({
            name: "id",
            desc: "The unique ID of the object.",
            as: "_id",
            type: types.ID,
            nullable: false,
            readonly: true,
        });
    }

    /** Adds a new index to the model. */
    public index(config: IndexDescription) {
        this.indexes.push(config);
        return this;
    }

    /**
     * Creates a list query for the model. This will automatically create arguments
     * for search, filter, sort and pagination.
     */
    public list(config: Omit<ModelQueryFieldConfig, "model"> = {
        name: pluralize(camel(this.name)),
        desc: `Searches for ${this.name} objects.`,
        searchable: true,
        sortable: true,
    }) {
        // get the Query object
        const query = this.__schema.__types["Query"] as ObjectDef;
        if (!query) throw new Error("Cannot create a list query for a model without a Query object.");
        if (query.fields[config.name]) throw new Error(`Field '${config.name}' already exists on model 'Query'`);

        query.fields[config.name] = new ModelQueryFieldDef({
            ...config,
            model: this,
        });

        return this;
    }

    /** Perform type expansion and preparation if necessary. */
    public override __prepare(ctx: BuildCtx) {
        const sortableFields = Object.values(this.fields)
            .filter(f => "isSortable" in f && f.isSortable);

        // do we have any sortable fields? if so, create an enum from them
        if (sortableFields.length > 0) {
            const e = new EnumDef(
                `${this.name}SortField`,
                `Fields that can be used for sorting ${this.name} objects.`,
            );

            for (const field of sortableFields) {
                e.value({
                    name: field.name + "_ASC",
                    desc: `Sorts by the ${field.name} field in ascending order.`,
                });
                e.value({
                    name: field.name + "_DESC",
                    desc: `Sorts by the ${field.name} field in descending order.`,
                });
            }

            this.__schema.__types[`${this.name}SortField`] = e;
            ctx.prepare(e);

            // // create the sort input
            // const sortInput = new InputObjectDef(
            //     `${this.name}SortInput`,
            //     `Sorts ${this.name} objects by the given field and direction.`,
            // );
        }

        super.__prepare(ctx);
    }

    // TODO: create the DBO type and the ODB object + functions
}