import { type PublicSchema, Schema } from "./Schema";
import type { Config } from "./config";
import * as types from "./scalars";

/**
 * Default scalar types that are always available in a MonoQL schema.
 */
export { types };

/** 
 * Provides the state and functions needed for creating a MonoQL schema.
 */
export function createSchema(config: Config = {}) {
    return new Schema(config) as PublicSchema;
}

/**
 * Defines the type for a schema.
 */
export type { PublicSchema as Schema };