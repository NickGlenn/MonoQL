import { MongoClient, type ObjectId, type Collection, type Db } from "mongodb";

export const UserDefaultResolver: UserResolver = ({}) => ({} as any);
export const QueryDefaultResolver: QueryResolver = ({}) => ({} as any);

type Maybe<T> = T | null;
type Ctx = { db: CollectionsMap };
type ResolverFn<S, A, R> = (source: S, args: A, context: Ctx) => R | Promise<R>;

/** All built-in and custom scalars, mapped to their actual values. */
export interface Scalars {
    ID: string;
    String: string;
    Boolean: boolean;
    Int: number;
    Float: number;
    ObjectID: ObjectId;
    Email: string;
    DateTime: Date;
    Date: Date;
}

/** Provides the database collections as an object and ensures indexes are created. */
export async function getDbCollections(db: Db): Promise<{ [name: string]: Collection }> {
    const collections: Partial<CollectionsMap> = {};
    collections.user = db.collection("user");
    await collections.user.ensureIndex({ email: 1 }, { unique: true });
    return collections as CollectionsMap;
}

export interface CollectionsMap {
    /** Collection of User records. */
    user: Collection<User>;
}

/** Resolver for the Query object type. */
export interface QueryResolver {
}

/** Resolver for the User object type. */
export interface UserResolver {
    name: ResolverFn<User, any, Scalars["String"]>;
}

/** */
export interface User {
    /** Password for the user account. This is hidden from clients. */
    password: Scalars["String"];
    /** Email address of the user. */
    email: Scalars["Email"];
    /** Date and time the record was last updated. */
    updatedAt: Scalars["DateTime"];
    /** Date and time the record was created. */
    createdAt: Scalars["DateTime"];
    /** Unique identifier for the record. */
    id: Scalars["ObjectID"];
}

export interface UserNameArgs {
}
