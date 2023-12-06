import type { ObjectBaseDef } from "./ObjectBaseDef";
import type { BaseFieldConfig } from "./FieldDef";
import { FieldDef } from "./FieldDef";

/**
 * Provides a field that is directly stored in the database on the object.
 */

export class ModelFieldDef extends FieldDef {

    /** Is the value of this field used as a "unique" index? */
    public readonly isUnique: boolean;

    /** Can the client sort by this field? */
    public readonly isSortable: boolean;

    /** Can the client filter by this field? */
    public readonly isFilterable: boolean;

    /** Name of the field in the database. */
    public override readonly dboName: string;

    /** Did the user explicitly mark the field as readonly? */
    public override readonly isReadonly: boolean;

    /** Is the field an internal, database-only field? */
    public override readonly isDboOnly: boolean;

    /** Default value of the field. */
    public readonly default: string | null;

    /** Is this field nullable? */
    public readonly isNullable: boolean;

    constructor(config: ModelFieldConfig) {
        super(config.name, config.type, config.desc);
        this.isUnique = config.unique ?? false;
        this.isSortable = config.sortable ?? false;
        this.isFilterable = config.filterable ?? false;
        this.isReadonly = config.readonly ?? false;
        this.dboName = config.as ?? config.name;
        this.default = config.default ?? null;
        this.isDboOnly = config.internal ?? false;
        this.isNullable = config.nullable ?? false;
    }

    public override getResolverImpl(ctx: BuildCtx, parent: ObjectBaseDef): string {
        return this.name !== this.dboName
            ? `doc => doc.${this.dboName}`
            : "";
    }

}


export interface ModelFieldConfig extends BaseFieldConfig {
    /** Is the value of this field used as a "unique" index? */
    unique?: boolean;
    /** Can the client sort by this field? */
    sortable?: boolean;
    /** Can the client filter by this field? */
    filterable?: boolean;
    /** Marks the field as explicitly being read-only. */
    readonly?: boolean;
    /** Can this field be searched against using a text search? */
    searchable?: boolean;
    /** Aliases the field to a different name in the database. */
    as?: string;
    /**
     * Default value to use when creating the related object. Must be specified
     * as a Typescript literal value.
     */
    default?: string;
    /** Marks the field as being an internal, database-only field. */
    internal?: boolean;
    /** Can the resulting value of this field be null? */
    nullable?: boolean;
}

