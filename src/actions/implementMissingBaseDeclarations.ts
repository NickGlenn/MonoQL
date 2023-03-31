import { DefinitionNode, DocumentNode, Kind } from "graphql";
import { PipelineAction } from "../index";
import { extensionToDefinition, Mutable } from "../internal";


/**
 * Implements missing types based on any objects that use the "extend" keyword.
 */
export function implementMissingBaseDeclarations(): PipelineAction {
    return {
        name: "Implement Missing Base Declarations",
        execute(ctx) {
            const ast = ctx.ast as Mutable<DocumentNode>;

            const seenTypeAndKinds: Record<string, Kind> = {};
            let schemaBaseSeen = false

            for (const definition of ast.definitions) {
                if (definition.kind === Kind.SCHEMA_DEFINITION) {
                    schemaBaseSeen = true;
                }
                else if (definition.kind === Kind.OBJECT_TYPE_DEFINITION
                    || definition.kind === Kind.INTERFACE_TYPE_DEFINITION
                    || definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
                    || definition.kind === Kind.ENUM_TYPE_DEFINITION
                    || definition.kind === Kind.UNION_TYPE_DEFINITION
                ) {
                    seenTypeAndKinds[definition.name.value] = definition.kind;
                }
            }

            for (let i = ast.definitions.length - 1; i >= 0; i--) {
                const definition = ast.definitions[i];

                // schema extensions are special case (they don't have a name)
                if (definition.kind === Kind.SCHEMA_EXTENSION) {
                    if (!schemaBaseSeen) {
                        ast.definitions.push({
                            kind: Kind.SCHEMA_DEFINITION,
                            directives: [],
                            operationTypes: [],
                        });
                        schemaBaseSeen = true;
                    }
                    continue;
                }

                // otherwise, just look for the other extension types
                if (
                    definition.kind === Kind.OBJECT_TYPE_EXTENSION
                    || definition.kind === Kind.INTERFACE_TYPE_EXTENSION
                    || definition.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION
                    || definition.kind === Kind.ENUM_TYPE_EXTENSION
                    || definition.kind === Kind.UNION_TYPE_EXTENSION
                ) {
                    const expectedBaseKind = extensionToDefinition[definition.kind];
                    if (!expectedBaseKind) throw new Error(`Unknown extension type "${definition.kind}"`);

                    const name = definition.name.value;
                    const seenKind = seenTypeAndKinds[name];

                    if (seenKind === expectedBaseKind) {
                        continue;
                    }

                    if (seenKind && seenKind !== expectedBaseKind) {
                        throw new Error(`Duplicate definition for type "${name}" of different kind.`);
                    }

                    seenTypeAndKinds[name] = expectedBaseKind;
                    ast.definitions.push({
                        kind: expectedBaseKind,
                        name: { kind: Kind.NAME, value: name },
                    } as Mutable<DefinitionNode>);
                }
            }
        },
    };
}
