import { Kind, type TypeNode } from "graphql";
import type { IBaseType } from "./Types";
import type { ISchemaDef } from "./Schema";


/**
 * Defines a new "primitive" type in the API.
 */
export class ScalarDef implements ISchemaDef, IBaseType {
    constructor(
        /** The name of the scalar type. */
        public readonly name: string,
        /** The Typescript equivalent of the scalar type. */
        public readonly tsType: string,
        /** Description of the scalar type. */
        public readonly desc: string = "",
    ) {
    }

    /** Generates the GraphQL equivalent. */
    public __generateApi(ctx: BuildCtx): void {
        ctx.genAst.definitions.push({
            kind: Kind.SCALAR_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: this.name },
            description: { kind: Kind.STRING, value: this.desc },
            directives: [], // TODO: use our @mql to map the TS type?
        });
    }

    /** Performs type expansion and prepartion if necessary. */
    public __prepare(ctx: BuildCtx): void {

    }

    /** Performs additional code generation. */
    public __generateImpl(ctx: BuildCtx) {
        // nothing to do here
    }

    /** Creates the Typescript equivalent of this type. */
    public toTsType(): string {
        return `ScalarMap["${this.name}"]`;
    }

    /** Creates the GraphQL equivalent of this type. */
    public toGqlType(): TypeNode {
        return {
            kind: Kind.NON_NULL_TYPE,
            type: {
                kind: Kind.NAMED_TYPE,
                name: { kind: Kind.NAME, value: this.name },
            },
        };
    }
}