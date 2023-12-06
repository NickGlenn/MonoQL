import { FieldDef } from "./FieldDef";
import { BaseFieldConfig } from "./FieldDef";


/**
 * Provides a field that is derived during aggregation on the database.
 */
export class DerivedFieldDef extends FieldDef {

    /** Derived fields never exist in the database. */
    public override readonly isReadonly: boolean = true;

    /** The MongoDB aggregation pipeline stage that derives the field. */
    public readonly derived: PipelineStage;

    /** Can the client sort by this field? */
    public readonly isSortable: boolean;

    /** Can the client filter by this field? */
    public readonly isFilterable: boolean;

    /** Is the field nullable? */
    public readonly isNullable: boolean;

    constructor(config: DerivedFieldConfig) {
        super(config.name, config.type, config.desc);
        this.derived = config.derived;
        this.isNullable = config.nullable ?? false;
        this.isSortable = config.sortable ?? false;
        this.isFilterable = config.filterable ?? false;
    }
}

export interface DerivedFieldConfig extends BaseFieldConfig {
    /**
     * Field is directly derived from other fields in the database. This is
     * converted directly into a MongoDB "$addFields" pipeline stage.
     */
    derived: PipelineStage;
    /** Can the client sort by this field? */
    sortable?: boolean;
    /** Can the client filter by this field? */
    filterable?: boolean;
    /** Can the resulting value of this field be null? */
    nullable?: boolean;
}

