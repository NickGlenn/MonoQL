import type { ConfigWithDefaults } from "./config";
import type * as ts from "ts-morph";
import type { ISchemaDef } from "./Schema";
import type { DocumentNode } from "graphql";
import type { Document } from "mongodb";
import type { BuildCtx as BuildCtxClass } from "./BuildCtx";


declare global {
    type MakeOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

    type MakeRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

    type Mutable<T> = {
        -readonly [P in keyof T]: Mutable<T[P]>;
    };

    type BuildCtx = BuildCtxClass;

    type PipelineStage = Document;

    /**
     * Maps GraphQL objects to their fields and provides the query system with the
     * necessary information to build aggregate queries based on the user's requsted
     * operation(s). Each field is able to specify custom pipeline stages that will
     * affect the final result of the query.
     */
    interface ObjectInfoTable {
        /** The name of the object type we're looking at. */
        [objectType: string]: {
            /** The field we're looking at to derive an action from. */
            [field: string]: {

            }
        };
    }
}

export { };