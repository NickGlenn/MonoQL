import { Kind, type FieldDefinitionNode, type InputValueDefinitionNode } from "graphql";
import type { ObjectBaseDef } from "./ObjectBaseDef";
import { deriveTrueType, type IBaseType } from "./Types";
import type { PropertySignatureStructure } from "ts-morph";

/**
 * Base class for all field definition types.
 */
export class FieldDef {

    /** Arguments that can be passed to the resolver. */
    public readonly args: Record<string, {
        /** The type of the argument. */
        type: FieldType;
        /** Description of the argument. */
        desc?: string;
        /** Default value for the argument. */
        default?: any;
    }> = {};

    /** The name to use for the field in the database. */
    public readonly dboName: string;

    /** Is the field readonly? */
    public readonly isReadonly: boolean = false;

    /** Does the field ONLY exist on the DTO (API)? */
    public readonly isDtoOnly: boolean = false;

    /** Does the field ONLY exist on the DBO? */
    public readonly isDboOnly: boolean = false;

    // does this exist on the database object?
    // is it a computed field?
    // directives?
    // resolver information
    // middleware for resolver
    // aggregate query information

    constructor(
        /** The name of the field. */
        public readonly name: string,
        /** The return type of the field, as provided via configuration. */
        public readonly type: FieldType,
        /** Description of the field. */
        public readonly desc: string = "",
    ) {
        this.dboName = name;
    }

    /** Performs type expansion and prepartion if necessary. */
    public prepare(ctx: BuildCtx, parent: ObjectBaseDef): void {

    }

    /** Gets the GraphQL equivalent of this field. */
    public getApiField(ctx: BuildCtx, parent: ObjectBaseDef): null | Mutable<FieldDefinitionNode> {
        if (this.isDboOnly) return null;
        const type = deriveTrueType(this.type);

        const args: Mutable<InputValueDefinitionNode>[] = [];
        for (const [name, arg] of Object.entries(this.args)) {
            const argtype = deriveTrueType(arg.type);

            // TODO: if arg is a model, ...
            // TODO: if arg is a union of models, ...

            args.push({
                kind: Kind.INPUT_VALUE_DEFINITION,
                name: { kind: Kind.NAME, value: name },
                description: { kind: Kind.STRING, value: arg.desc ?? "" },
                type: argtype.toGqlType(),
                defaultValue: undefined, // TODO:
            });
        }

        return {
            kind: Kind.FIELD_DEFINITION,
            name: { kind: Kind.NAME, value: this.name },
            description: { kind: Kind.STRING, value: this.desc },
            type: type.toGqlType(),
            arguments: args,
            directives: [],
        };
    }

    /** Returns the Typescript equivalent of this field for the DBO. */
    public getDboField(ctx: BuildCtx, parent: ObjectBaseDef): null | Omit<PropertySignatureStructure, "kind"> {
        if (this.isDtoOnly) return null;
        const type = deriveTrueType(this.type);

        return {
            name: this.dboName,
            docs: [this.desc],
            type: type.toTsType(),
        };
    }

    /** Gets the resolver implmentation for the field. */
    public getResolverImpl(ctx: BuildCtx, parent: ObjectBaseDef): string {
        return "";
    }

    /** When this field is used within an aggregate query, what rules apply? */
    public getQueryRules(ctx: BuildCtx, parent: ObjectBaseDef): null | ObjectInfoTable[string][string] {
        return null;
    }
}

export interface BaseFieldConfig<T extends FieldType = FieldType> {
    /** The name of the field. */
    name: string;
    /** Description of the field. */
    desc?: string;
    /** Type of the field. */
    type: T;
}

/** The type of the configuration that can be passed to a field. */
export type FieldType = IBaseType | [IBaseType] | (() => IBaseType | [IBaseType]);