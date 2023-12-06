import { Kind, type TypeNode } from "graphql";


/**
 * Interface that must be implemented by all core types. This includes
 * scalars, enums, unions, lists, and nullables.
 */
export interface IBaseType {

    // TODO:

    /** Creates the Typescript equivalent of this type. */
    toTsType(): string;

    /** Creates the GraphQL equivalent of this type. */
    toGqlType(): TypeNode;

}

/**
 * Marks the given type as being nullable.
 */
export class Nullable<T extends IBaseType> implements IBaseType {

    constructor(
        /** The type that is nullable. */
        public readonly type: T,
    ) { }

    public toTsType(): string {
        return `Maybe<${this.type.toTsType()}>`;
    }

    public toGqlType(): TypeNode {
        let inner = this.type.toGqlType();
        while (inner.kind === Kind.NON_NULL_TYPE) {
            inner = inner.type;
        }
        return inner;
    }

}

/**
 * Marks the given type as being a list.
 */
export class List<T extends IBaseType> implements IBaseType {

    constructor(
        /** The type that is a list. */
        public readonly type: T,
    ) { }

    public toTsType(): string {
        return `Array<${this.type.toTsType()}>`;
    }

    public toGqlType(): TypeNode {
        return {
            kind: Kind.NON_NULL_TYPE,
            type: {
                kind: Kind.LIST_TYPE,
                type: this.type.toGqlType(),
            },
        };
    }

}


/** 
 * Helper that converts our convenience input formats for types into 
 * the IBaseType format.
 */
export function deriveTrueType(
    type: IBaseType | [IBaseType] | (() => IBaseType | [IBaseType]),
    makeNullable = false,
) {
    let t = type;
    if (typeof t === "function") {
        t = t();
    }

    if (Array.isArray(t)) {
        t = new List(t[0]);
    }

    if (makeNullable) {
        t = new Nullable(t);
    }

    return t;
}