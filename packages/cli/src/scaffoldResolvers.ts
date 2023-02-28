import { DocumentNode, Kind } from "graphql";
import { ExportedDeclarations, FunctionDeclaration, Project } from "ts-morph";
import type { Mutable } from "./parser";

/**
 * Scaffolds out resolvers as individual functions if it can't be found in any
 * of the files within the specified "resolvers" directory.
 */
export function scaffoldResolvers(ast: Mutable<DocumentNode>, resolversDir: string) {
    // find all the resolver files in the resolvers/ directory and load them
    // with TS morph
    const project = new Project();

    for (const definition of ast.definitions) {
        if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION) {
            continue;
        }

        const name = definition.name.value;
        const resolversMap: Record<string, ExportedDeclarations> = {};

        // is there a directory of resolver files for this type? if so, we'll scan the files in
        // the directory and load them
        const dir = project.getDirectory(`${resolversDir}/${name}`);
        if (dir) {
            // iterate over each file in the directory and load it - create a map of exported
            // resolver functions to their names
            for (const file of dir.getSourceFiles()) {
                console.log(file.getFilePath());
                // for (const exportDec of file.getExportedDeclarations()) {
                //     resolversMap[exportDec[0]] = exportDec[1];
                // }
            }
        }
        // otherwise, try to find a single file for this type


        // find the resolver file OR directory of resolvers for this type
        // if neither exist, create a new file for this type
        const resolverFile = project.getSourceFile(`${resolversDir}/${name}.ts`);
        if (resolverFile) {

        }

        // walk over each field and add a resolver
    }
}