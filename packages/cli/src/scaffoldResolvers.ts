import type { DocumentNode } from "graphql";
import type { Mutable } from "./parser";

/**
 * Scaffolds out resolvers as individual functions if it can't be found in any
 * of the files within the specified "resolvers" directory.
 */
export function scaffoldResolvers(ast: Mutable<DocumentNode>, resolversDir: string) {

}