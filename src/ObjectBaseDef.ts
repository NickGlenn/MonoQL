import type { ISchemaDef } from "./Schema";
import type { InterfaceDef } from "./InterfaceDef";
import type { ScalarDef } from "./ScalarDef";
import type { FieldDef } from "./FieldDef";
import type { DerivedFieldConfig } from "./DerivedFieldDef";
import type { TypeNode } from "graphql";
import { VariableDeclarationKind } from "ts-morph";
import { DerivedFieldDef } from "./DerivedFieldDef";
import * as types from "./scalars";
import { ModelFieldConfig, ModelFieldDef } from "./ModelFieldDef";
import { Kind } from "graphql";

/**
 * Provides a base class with the common functionality of adding standard
 * fields to the object type.
 */
export abstract class ObjectBaseDef implements ISchemaDef {

    /** The fields that are defined on this object type. */
    public readonly fields: Record<string, FieldDef> = {};

    /** The interfaces that this object type implements. */
    public readonly interfaces: InterfaceDef[] = [];

    constructor(
        /** The name of the object type. */
        public readonly name: string,
        /** Description of the object type. */
        public readonly desc: string = "",
    ) {
    }

    /** Adds an interface definition that the object implements. */
    public implements(iface: InterfaceDef) {
        if (!this.interfaces.includes(iface)) {
            this.interfaces.push(iface);

            for (const f of Object.values(iface.fields)) {
                if (this.fields[f.name]) {
                    throw new Error(`Field "${f.name}" already exists on object type "${this.name}".`);
                }

                this.fields[f.name] = f;
            }
        }

        return this;
    }

    /** Adds a standard field to the object type. */
    public field(config: ModelFieldConfig) {
        if (this.fields[config.name]) {
            throw new Error(`Field "${config.name}" already exists on object type "${this.name}".`);
        }

        this.fields[config.name] = new ModelFieldDef(config);
        type C = typeof config;
        return this as (typeof this & { [k in C["name"]]: FieldDef });
    }

    /** Adds a derived field to the object type. */
    public derived(config: DerivedFieldConfig) {
        if (this.fields[config.name]) {
            throw new Error(`Field "${config.name}" already exists on object type "${this.name}".`);
        }

        this.fields[config.name] = new DerivedFieldDef(config);
        type C = typeof config;
        return this as (typeof this & { [k in C["name"]]: FieldDef });
    }

    /** Internal helper for creating a typed field config. */
    private _field<T, WithDefault extends boolean>(type: ScalarDef) {
        return (config: TypeFieldConfig<T, WithDefault>) => {
            let tsDefault: undefined | string;
            if ("default" in config && config.default !== undefined) {
                tsDefault = JSON.stringify(config.default);
            }

            return this.field({
                ...config,
                default: tsDefault,
                type: type,
            });
        }
    }

    /** Adds a standard boolean field to the object type. */
    public boolean = this._field<boolean, true>(types.Boolean);

    /** Adds a standard integer field to the object type. */
    public int = this._field<number, true>(types.Int);

    /** Adds a standard uint field to the object type. */
    public uint = this._field<number, true>(types.Uint);

    /** Adds a standard float field to the object type. */
    public float = this._field<number, true>(types.Float);

    /** Adds a standard string field to the object type. */
    public string = this._field<string, true>(types.String);

    /** Adds a standard email field to the object type. */
    public email = this._field<string, false>(types.Email);

    /** 
     * Adds a standard date field to the object type. Note that this field only
     * supports dates, and not dates with times.
     */
    public date = this._field<Date, false>(types.Date);

    /**
     * Adds a standard datetime field to the object type. Note that this field
     * only supports dates with times, and not dates without times.
     */
    public datetime = this._field<Date, false>(types.DateTime);

    /** Adds a standard JSON field to the object type. */
    public json = this._field<any, false>(types.Json);

    /** Performs type expansion and prepartion if necessary. */
    public __prepare(ctx: BuildCtx): void {
        // allow fields to prepare themselves
        for (const f of Object.values(this.fields)) {
            f.prepare(ctx, this);
        }
    }

    /** Generates the API schema for this type. */
    public __generateApi(ctx: BuildCtx): void {
        const fields = Object.values(this.fields);
        let kind = Kind.OBJECT_TYPE_DEFINITION;
        if (ctx.userAst?.definitions.find(d => "name" in d && d.name!.value === this.name)) {
            if (this.name !== "Query" && this.name !== "Mutation") {
                throw new Error(`Unable to create object type "${this.name}" because it already exists in your GraphQL schema.`);
            }

            kind = Kind.OBJECT_TYPE_EXTENSION;
        }

        ctx.genAst.definitions.push({
            kind,
            name: { kind: Kind.NAME, value: this.name },
            description: { kind: Kind.STRING, value: this.desc },
            directives: [],
            interfaces: this.interfaces.filter(iface => !iface.abstract).map(iface => ({
                kind: Kind.NAMED_TYPE,
                name: { kind: Kind.NAME, value: iface.name },
            })),
            fields: fields.flatMap(f => {
                const field = f.getApiField(ctx, this);
                return field ? [field] : [];
            }),
        });
    }

    /** Builds the object type. */
    public __generateImpl(ctx: BuildCtx): void {
        // create an object for the resolver implementation
        ctx.output.addVariableStatement({
            declarationKind: VariableDeclarationKind.Const,
            isExported: true,
            declarations: [{
                name: `${this.name}Resolvers`,
                type: `Api.${this.name}Resolvers`,
                initializer: w => {
                    w.write(`{`);

                    for (const f of Object.values(this.fields)) {
                        const impl = f.getResolverImpl(ctx, this);
                        if (!impl) continue;

                        w.writeLine(`${f.name}: ${impl},`);
                    }

                    w.write(`}`);
                },
            }],
        });

        const rules = ctx.objectInfo[this.name] = {} as ObjectInfoTable[string];

        for (const f of Object.values(this.fields)) {
            const impl = f.getQueryRules(ctx, this);
            if (!impl) continue;

            rules[f.name] = impl;
        }
    }

    public toGqlType(): TypeNode {
        return {
            kind: Kind.NON_NULL_TYPE,
            type: {
                kind: Kind.NAMED_TYPE,
                name: { kind: Kind.NAME, value: this.name },
            },
        };
    }

    public toTsType(): string {
        return this.name;
    }
}

export type TypeFieldConfig<T, WithDefault extends boolean> = Omit<ModelFieldConfig, "default" | "type"> &
    (WithDefault extends true ? {
        /** Default value of the field. */
        default?: T;
    } : {});
