import { DocumentNode, Kind } from "graphql";
import { PipelineAction } from "../index";
import { baseTypeKinds, extensionToDefinition, mergableFieldsByKind, Mutable } from "../internal";


/**
 * Flattens extension types into their base types. Throws an error on any duplicate fields
 * of the same name but different types.
 */
export function flattenExtensionTypes(): PipelineAction {
    return {
        name: "Flatten Extension Types",
        execute(ctx) {
            // TODO: add support for merging documentation

            type NodeIsh = { kind: Kind, name: { value: string } } & Record<string, any[]>;

            const ast = ctx.ast as Mutable<DocumentNode>;
            const baseTypes: Record<string, NodeIsh> = {};

            // find all the base types
            for (const definition of ast.definitions) {
                if (baseTypeKinds.includes(definition.kind) && "name" in definition) {
                    baseTypes[(definition as unknown as NodeIsh).name.value] = definition as unknown as NodeIsh;
                }
            }

            // find all the extensions and merge them into the base types
            for (let i = ast.definitions.length - 1; i >= 0; i--) {
                const extType: NodeIsh = ast.definitions[i] as any;
                const baseType = baseTypes[extType.name.value];

                if (!extensionToDefinition[extType.kind]) {
                    continue;
                }

                if (!baseType) {
                    throw new Error(`Cannot extend type "${extType.name.value}" because it does not exist.`);
                }

                if (baseType.kind !== extensionToDefinition[extType.kind]) {
                    throw new Error(`Cannot extend type "${extType.name.value}" because it is not the same kind.`);
                }

                for (const field of mergableFieldsByKind[extType.kind]) {
                    if (!extType[field]) {
                        continue;
                    }

                    baseType[field] = baseType[field] || [];

                    for (const ext of extType[field]) {
                        const existing = baseType[field].find(f => f.name.value === ext.name.value);
                        if (existing) {
                            if (
                                existing.type.kind !== ext.type.kind ||
                                (existing.type.kind === Kind.NAMED_TYPE &&
                                    existing.type.name.value !== ext.type.name.value)
                            ) {
                                throw new Error(`Cannot extend type "${(extType as any).name.value}" because it has a duplicate field "${ext.name.value}" with a different type.`);
                            }
                        } else {
                            baseType[field].push(ext);
                        }
                    }
                }

                // remove the extension
                ast.definitions.splice(i, 1);
            }
        },
    };
}