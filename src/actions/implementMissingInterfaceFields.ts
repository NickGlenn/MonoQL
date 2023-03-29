import { DocumentNode, InterfaceTypeDefinitionNode, Kind } from "graphql";
import { ensureActionIsUnique } from "../utils";
import { PipelineAction } from "../core";
import type { Mutable } from "../types";

/**
 * Finds all object type definitions that implement an interface and automatically implements
 * the interface's fields on the object type if not explicitly defined.
 */
export function implementMissingInterfaceFields(): PipelineAction {
    return {
        name: "Implement Missing Interface Fields",
        validate(ctx) {
            ensureActionIsUnique(ctx);
        },
        execute(ctx) {
            const ast = ctx.ast as Mutable<DocumentNode>;
            const interfaceMap: Record<string, Mutable<InterfaceTypeDefinitionNode>> = {};

            // first, we will build a map of all interfaces
            for (const definition of ast.definitions) {
                if (definition.kind === Kind.INTERFACE_TYPE_DEFINITION) {
                    interfaceMap[definition.name.value] = definition;
                }
            }

            // now process all object types and iterate through their interfaces
            for (const definition of ast.definitions) {
                // skip non-object types
                if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION) {
                    continue;
                }

                // skip if the object type does not implement any interfaces
                if (!definition.interfaces || definition.interfaces.length === 0) {
                    continue;
                }

                // iterate through all interfaces and implement their fields
                for (const iface of definition.interfaces) {
                    const interfaceDefinition = interfaceMap[iface.name.value];
                    if (!interfaceDefinition) {
                        console.warn(`Interface ${iface.name.value} does not exist.`);
                        continue;
                    }

                    // ensure the object type has a fields array
                    definition.fields = definition.fields || [];

                    // iterate through all fields and add them if they do not already exist
                    for (const field of interfaceDefinition?.fields || []) {
                        if (!definition.fields.find((f) => f.name.value === field.name.value)) {
                            definition.fields.push(field);
                        }
                    }
                }
            }
        },
    };
}