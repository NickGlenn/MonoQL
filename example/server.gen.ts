import { MongoClient, type ObjectId, type Collection, type Db } from "mongodb";

export const QueryDefaultResolver: QueryResolver = ({}) => ({} as any);
export const UserDefaultResolver: UserResolver = ({}) => ({} as any);
export const CatDefaultResolver: CatResolver = ({}) => ({} as any);
export const DogDefaultResolver: DogResolver = ({}) => ({} as any);

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
    return collections as CollectionsMap;
}

export interface CollectionsMap {
}

/** */
export interface Creature {
    /** */
    species: Scalars["String"];
}

/** */
export interface Dog extends Creature {
    /** */
    species: Scalars["String"];
    /** */
    breed?: Maybe<DogBreed>;
    /** */
    name: Scalars["String"];
}

/** Resolver for the Dog object type. */
export interface DogResolver {
    /** */
    species?: ResolverFn<Dog, Dog_Species_Args, Scalars["String"]>;
    /** */
    breed?: ResolverFn<Dog, Dog_Breed_Args, Maybe<DogBreed>>;
    /** */
    name?: ResolverFn<Dog, Dog_Name_Args, Scalars["String"]>;
}

/** Wrapped resolver for the Dog object type. */
export interface DogWrappedResolver {
}

/** Arguments for the Dog.species resolver. */
export interface Dog_Species_Args {
}

/** Arguments for the Dog.breed resolver. */
export interface Dog_Breed_Args {
}

/** Arguments for the Dog.name resolver. */
export interface Dog_Name_Args {
}

/** */
export enum DogBreed {
    /** A small dog breed. */
    SMALL,
    /** A medium dog breed. */
    MEDIUM,
    /** A large dog breed. */
    LARGE
}

/** */
export interface Cat extends Creature {
    /** */
    species: Scalars["String"];
    /** */
    name: Scalars["String"];
}

/** Resolver for the Cat object type. */
export interface CatResolver {
    /** */
    species?: ResolverFn<Cat, Cat_Species_Args, Scalars["String"]>;
    /** */
    name?: ResolverFn<Cat, Cat_Name_Args, Scalars["String"]>;
}

/** Wrapped resolver for the Cat object type. */
export interface CatWrappedResolver {
}

/** Arguments for the Cat.species resolver. */
export interface Cat_Species_Args {
}

/** Arguments for the Cat.name resolver. */
export interface Cat_Name_Args {
}

/** */
export type Animal = Dog | Cat;

/** */
export interface Node {
    /** The globally unique identifier for the node. */
    id: Scalars["ID"];
    /** The date/time when the node was created. */
    createdAt: Scalars["DateTime"];
    /** The date/time when the node was last updated. */
    updatedAt: Scalars["DateTime"];
}

/** */
export interface User extends Node {
    /** The date/time when the node was last updated. */
    updatedAt: Scalars["DateTime"];
    /** The date/time when the node was created. */
    createdAt: Scalars["DateTime"];
    /** The globally unique identifier for the node. */
    id: Scalars["ID"];
    /** Password for the user account. This is hidden from clients. */
    password: Scalars["String"];
    /** Email address of the user. */
    email: Scalars["Email"];
}

/** Resolver for the User object type. */
export interface UserResolver {
    /** The date/time when the node was last updated. */
    updatedAt?: ResolverFn<User, User_UpdatedAt_Args, Scalars["DateTime"]>;
    /** The date/time when the node was created. */
    createdAt?: ResolverFn<User, User_CreatedAt_Args, Scalars["DateTime"]>;
    /** The globally unique identifier for the node. */
    id?: ResolverFn<User, User_Id_Args, Scalars["ID"]>;
    /** Full name of the user. */
    name?: ResolverFn<User, User_Name_Args, Scalars["String"]>;
    /** Password for the user account. This is hidden from clients. */
    password?: ResolverFn<User, User_Password_Args, Scalars["String"]>;
    /** Email address of the user. */
    email?: ResolverFn<User, User_Email_Args, Scalars["Email"]>;
}

/** Wrapped resolver for the User object type. */
export interface UserWrappedResolver {
    name: UserResolver["name"];
}

/** Arguments for the User.updatedAt resolver. */
export interface User_UpdatedAt_Args {
}

/** Arguments for the User.createdAt resolver. */
export interface User_CreatedAt_Args {
}

/** Arguments for the User.id resolver. */
export interface User_Id_Args {
}

/** Arguments for the User.name resolver. */
export interface User_Name_Args {
}

/** Arguments for the User.password resolver. */
export interface User_Password_Args {
}

/** Arguments for the User.email resolver. */
export interface User_Email_Args {
}

/** */
export interface Query {
    /** Returns all users that the caller has access to. */
    users?: Maybe<UserConnection>;
    /** Returns a user by ID, if they exist and the caller has access to it. */
    user?: Maybe<User>;
    /** Returns the current authenticated user. */
    caller?: Maybe<User>;
}

/** Resolver for the Query object type. */
export interface QueryResolver {
    /** Returns all users that the caller has access to. */
    users?: ResolverFn<Query, Query_Users_Args, Maybe<UserConnection>>;
    /** Returns a user by ID, if they exist and the caller has access to it. */
    user?: ResolverFn<Query, Query_User_Args, Maybe<User>>;
    /** Returns the current authenticated user. */
    caller?: ResolverFn<Query, Query_Caller_Args, Maybe<User>>;
}

/** Wrapped resolver for the Query object type. */
export interface QueryWrappedResolver {
}

/** Arguments for the Query.users resolver. */
export interface Query_Users_Args {
}

/** Arguments for the Query.user resolver. */
export interface Query_User_Args {
    /** */
    id: Scalars["ID"];
}

/** Arguments for the Query.caller resolver. */
export interface Query_Caller_Args {
}
