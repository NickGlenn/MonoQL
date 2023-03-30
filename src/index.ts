import type { DocumentNode } from "graphql";
import { flattenExtensionTypes } from "./actions/flattenExtensionTypes";
import { generateClient, GenerateClientConfig } from "./actions/generateClient";
import { generateRelayConnectionTypes, GenerateRelayConnectionTypesOptions } from "./actions/generateRelayConnectionTypes";
import { generateServer, GenerateServerConfig } from "./actions/generateServer";
import { implementMissingBaseDeclarations } from "./actions/implementMissingBaseDeclarations";
import { implementMissingInterfaceFields } from "./actions/implementMissingInterfaceFields";
import { runTransformers } from "./actions/runTransformers";
import { saveSchema } from "./actions/saveSchema";
import { PipelineAction, runPipeline } from "./runner";

/**
 * Defines a "transformer" function that can be used to modify the AST.
 */
export type TransformSchemaFn = (ast: DocumentNode) => DocumentNode;


export interface MonoQLConfig {
    /** Glob pattern pointing to the schema file(s) to use. */
    schema: string;
    /** Custom transformation(s) to apply to the schema before generating types. */
    transformSchema?: TransformSchemaFn | TransformSchemaFn[];
    /** When true, schema normalization will be skipped. */
    skipNormalization?: boolean;
    /** Options to use when generating Relay connection types. */
    relayConnectionTypes?: false | GenerateRelayConnectionTypesOptions;
    /** Output generation targets. */
    generates: GenerateConfig | GenerateConfig[];
};

interface SchemaOutputConfig {
    /** Outputs the resulting schema to a file. */
    schema: string;
}

type GenerateConfig =
    | SchemaOutputConfig
    | GenerateClientConfig
    | GenerateServerConfig
    ;

/**
 * Creates the recommended type definitions for a GraphQL server using Typescript
 * and handles scaffolding of new resolver directories and files.
 */
export function monoql({
    schema,
    transformSchema = [],
    relayConnectionTypes = {},
    skipNormalization,
    generates,
}: MonoQLConfig) {
    const actions: PipelineAction[] = [];

    if (!skipNormalization) {
        actions.push(
            implementMissingBaseDeclarations(),
            flattenExtensionTypes(),
            implementMissingInterfaceFields(),
        );
    }

    if (relayConnectionTypes !== false) {
        actions.push(generateRelayConnectionTypes(relayConnectionTypes));
    }

    actions.push(runTransformers(transformSchema));

    const _generates = Array.isArray(generates) ? generates : [generates];

    for (const outputConfig of _generates) {
        if ("schema" in outputConfig) {
            actions.push(saveSchema(outputConfig.schema));
        }
        else if ("client" in outputConfig) {
            actions.push(generateClient(outputConfig));
        }
        else if ("server" in outputConfig) {
            actions.push(generateServer(outputConfig));
        }
    }

    return runPipeline(schema, actions);
}