type Ctx = {};
type Maybe<T> = T | null;
type ResolverFn<S, A, R> = (source: S, args: A, context: Ctx) => R | Promise<R>;

export interface Scalar {
    String: string;
    Int: number;
    Float: number;
    Boolean: boolean;
    ID: string;
    /** */
    Email: string;
    /** */
    DateTime: Date;
}

/** */
export interface Creature {
    /** */
    species: Scalar["String"];
}

/** */
export interface Dog extends Creature {
    /** */
    name: Scalar["String"];
    /** */
    breed?: Maybe<DogBreed>;
    /** */
    species: Scalar["String"];
}

/** */
export interface DogResolver {
    name?: ResolverFn<Dog, DogResolver.name.Args, DogResolver.name.Result>;
    breed?: ResolverFn<Dog, DogResolver.breed.Args, DogResolver.breed.Result>;
    species?: ResolverFn<Dog, DogResolver.species.Args, DogResolver.species.Result>;
}

export namespace DogResolver {
    export namespace name {
        export interface Args {
        }

        export type Result = Scalar["String"];
    }

    export namespace breed {
        export interface Args {
        }

        export type Result = Maybe<DogBreed>;
    }

    export namespace species {
        export interface Args {
        }

        export type Result = Scalar["String"];
    }
}

/** */
export enum DogBreed {
    /** A small dog breed. */
    SMALL = "SMALL",
    /** A medium dog breed. */
    MEDIUM = "MEDIUM",
    /** A large dog breed. */
    LARGE = "LARGE"
}

/** */
export interface Cat extends Creature {
    /** */
    name: Scalar["String"];
    /** */
    species: Scalar["String"];
}

/** */
export interface CatResolver {
    name?: ResolverFn<Cat, CatResolver.name.Args, CatResolver.name.Result>;
    species?: ResolverFn<Cat, CatResolver.species.Args, CatResolver.species.Result>;
}

export namespace CatResolver {
    export namespace name {
        export interface Args {
        }

        export type Result = Scalar["String"];
    }

    export namespace species {
        export interface Args {
        }

        export type Result = Scalar["String"];
    }
}

/** */
export type Animal = Dog | Cat;
/** */
export type Email = Scalar["Email"];
/** */
export type DateTime = Scalar["DateTime"];

/** */
export interface Node {
    /** The globally unique identifier for the node. */
    id: Scalar["ID"];
    /** The date/time when the node was created. */
    createdAt: DateTime;
    /** The date/time when the node was last updated. */
    updatedAt: DateTime;
}

/** */
export interface User extends Node {
    /** Email address of the user. */
    email: Email;
    /** Password for the user account. This is hidden from clients. */
    password: Scalar["String"];
    /** Full name of the user. */
    name: Scalar["String"];
    /** The globally unique identifier for the node. */
    id: Scalar["ID"];
    /** The date/time when the node was created. */
    createdAt: DateTime;
    /** The date/time when the node was last updated. */
    updatedAt: DateTime;
}

/** */
export interface UserResolver {
    email?: ResolverFn<User, UserResolver.email.Args, UserResolver.email.Result>;
    password?: ResolverFn<User, UserResolver.password.Args, UserResolver.password.Result>;
    name?: ResolverFn<User, UserResolver.name.Args, UserResolver.name.Result>;
    id?: ResolverFn<User, UserResolver.id.Args, UserResolver.id.Result>;
    createdAt?: ResolverFn<User, UserResolver.createdAt.Args, UserResolver.createdAt.Result>;
    updatedAt?: ResolverFn<User, UserResolver.updatedAt.Args, UserResolver.updatedAt.Result>;
}

export namespace UserResolver {
    export namespace email {
        export interface Args {
        }

        export type Result = Email;
    }

    export namespace password {
        export interface Args {
        }

        export type Result = Scalar["String"];
    }

    export namespace name {
        export interface Args {
        }

        export type Result = Scalar["String"];
    }

    export namespace id {
        export interface Args {
        }

        export type Result = Scalar["ID"];
    }

    export namespace createdAt {
        export interface Args {
        }

        export type Result = DateTime;
    }

    export namespace updatedAt {
        export interface Args {
        }

        export type Result = DateTime;
    }
}

/** */
export interface Mutation {
    /** Creates a new user. */
    createAccount: Scalar["Boolean"];
}

/** */
export interface MutationResolver {
    createAccount?: ResolverFn<Mutation, MutationResolver.createAccount.Args, MutationResolver.createAccount.Result>;
}

export namespace MutationResolver {
    export namespace createAccount {
        export interface Args {
            /** */
            email: Email;
            /** */
            password: Scalar["String"];
        }

        export type Result = Scalar["Boolean"];
    }
}

/** */
export interface Query {
    /** Returns the current authenticated user. */
    caller?: Maybe<User>;
    /** Returns a user by ID, if they exist and the caller has access to it. */
    user?: Maybe<User>;
    /** Returns all users that the caller has access to. */
    users?: Maybe<UserConnection>;
}

/** */
export interface QueryResolver {
    caller?: ResolverFn<Query, QueryResolver.caller.Args, QueryResolver.caller.Result>;
    user?: ResolverFn<Query, QueryResolver.user.Args, QueryResolver.user.Result>;
    users?: ResolverFn<Query, QueryResolver.users.Args, QueryResolver.users.Result>;
}

export namespace QueryResolver {
    export namespace caller {
        export interface Args {
        }

        export type Result = Maybe<User>;
    }

    export namespace user {
        export interface Args {
            /** */
            id: Scalar["ID"];
        }

        export type Result = Maybe<User>;
    }

    export namespace users {
        export interface Args {
        }

        export type Result = Maybe<UserConnection>;
    }
}

/** A connection to a list of `User` items. */
export interface UserConnection {
    /** A list of `User` objects. */
    nodes: Array<User>;
    /** Information to aid in pagination. */
    pageInfo?: Maybe<PageInfo>;
    /** Returns the first _n_ elements from the list. */
    first?: Maybe<Scalar["Int"]>;
    /** Returns the elements in the list that come after the specified cursor. */
    after?: Maybe<Scalar["String"]>;
}

/** A connection to a list of `User` items. */
export interface UserConnectionResolver {
    nodes?: ResolverFn<UserConnection, UserConnectionResolver.nodes.Args, UserConnectionResolver.nodes.Result>;
    pageInfo?: ResolverFn<UserConnection, UserConnectionResolver.pageInfo.Args, UserConnectionResolver.pageInfo.Result>;
    first?: ResolverFn<UserConnection, UserConnectionResolver.first.Args, UserConnectionResolver.first.Result>;
    after?: ResolverFn<UserConnection, UserConnectionResolver.after.Args, UserConnectionResolver.after.Result>;
}

export namespace UserConnectionResolver {
    export namespace nodes {
        export interface Args {
        }

        export type Result = Array<User>;
    }

    export namespace pageInfo {
        export interface Args {
        }

        export type Result = Maybe<PageInfo>;
    }

    export namespace first {
        export interface Args {
        }

        export type Result = Maybe<Scalar["Int"]>;
    }

    export namespace after {
        export interface Args {
        }

        export type Result = Maybe<Scalar["String"]>;
    }
}

/** */
export interface PageInfo {
    /** When paginating forwards, are there more items? */
    hasNextPage?: Maybe<Scalar["Boolean"]>;
    /** When paginating backwards, are there more items? */
    hasPreviousPage?: Maybe<Scalar["Boolean"]>;
    /** When paginating backwards, the cursor to continue. */
    startCursor?: Maybe<Scalar["String"]>;
    /** When paginating forwards, the cursor to continue. */
    endCursor?: Maybe<Scalar["String"]>;
}

/** */
export interface PageInfoResolver {
    hasNextPage?: ResolverFn<PageInfo, PageInfoResolver.hasNextPage.Args, PageInfoResolver.hasNextPage.Result>;
    hasPreviousPage?: ResolverFn<PageInfo, PageInfoResolver.hasPreviousPage.Args, PageInfoResolver.hasPreviousPage.Result>;
    startCursor?: ResolverFn<PageInfo, PageInfoResolver.startCursor.Args, PageInfoResolver.startCursor.Result>;
    endCursor?: ResolverFn<PageInfo, PageInfoResolver.endCursor.Args, PageInfoResolver.endCursor.Result>;
}

export namespace PageInfoResolver {
    export namespace hasNextPage {
        export interface Args {
        }

        export type Result = Maybe<Scalar["Boolean"]>;
    }

    export namespace hasPreviousPage {
        export interface Args {
        }

        export type Result = Maybe<Scalar["Boolean"]>;
    }

    export namespace startCursor {
        export interface Args {
        }

        export type Result = Maybe<Scalar["String"]>;
    }

    export namespace endCursor {
        export interface Args {
        }

        export type Result = Maybe<Scalar["String"]>;
    }
}
