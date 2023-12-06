import { Kind, TypeNode } from "graphql";
import type { IBaseType } from "./Types";
import type { ISchemaDef } from "./Schema";

/**
 * Defines an enum type in the API and Typescript code.
 */
export class EnumDef implements ISchemaDef, IBaseType {

    /** The values that are defined on this enum type. */
    public readonly values: Record<string, EnumValueDef> = {};

    constructor(
        /** The name of the enum type. */
        public readonly name: string,
        /** Description of the enum type. */
        public readonly desc: string = "",
    ) {
    }

    /** Adds a value to the enum type. */
    public value(config: MakeOptional<EnumValueDef, "desc" | "as">) {
        // check if the value already exists
        if (this.values[config.name]) {
            throw new Error(`Enum value "${config.name}" already exists on enum type "${this.name}".`);
        }

        // add the value
        this.values[config.name] = {
            name: config.name,
            desc: config.desc ?? "",
            as: config.as ?? config.name,
        };

        type C = typeof config;
        return this as (typeof this & {
            [key in C["name"]]: C["as"] extends undefined ? C["name"] : C["as"];
        });
    }

    /** Performs type expansion and prepartion if necessary. */
    public __prepare(ctx: BuildCtx): void {

    }

    /** Generates the GraphQL equivalent. */
    public __generateApi({ genAst }: BuildCtx): void {
        genAst.definitions.push({
            kind: Kind.ENUM_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: this.name },
            description: { kind: Kind.STRING, value: this.desc },
            directives: [],
            values: Object.values(this.values).map(v => ({
                kind: Kind.ENUM_VALUE_DEFINITION,
                name: { kind: Kind.NAME, value: v.name },
                description: { kind: Kind.STRING, value: v.desc },
                directives: v.as ? [{
                    kind: Kind.DIRECTIVE,
                    name: { kind: Kind.NAME, value: "mql" },
                    arguments: [{
                        kind: Kind.ARGUMENT,
                        name: { kind: Kind.NAME, value: "as" },
                        value: { kind: Kind.STRING, value: "" + v.as },
                    }],
                }] : [],
            })),
        });
    }

    /** Generate Typescript code that is not covered by the API generation. */
    public __generateImpl(ctx: BuildCtx) {
    }

    toTsType(): string {
        return this.name;
    }

    toGqlType(): TypeNode {
        return {
            kind: Kind.NON_NULL_TYPE,
            type: {
                kind: Kind.NAMED_TYPE,
                name: { kind: Kind.NAME, value: this.name },
            },
        };
    }

}


/**
 * Defines a value on an enum type.
 */
export interface EnumValueDef {
    /** The name of the enum value. */
    name: string,
    /** Description of the enum value. */
    desc: string,
    /** The Typescript value of the enum. */
    as: string | number,
}