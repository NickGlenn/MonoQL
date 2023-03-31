import { PipelineAction } from "../index";
import { flattenExtensionTypes } from "./flattenExtensionTypes";
import { implementMissingBaseDeclarations } from "./implementMissingBaseDeclarations";
import { implementMissingInterfaceFields } from "./implementMissingInterfaceFields";

/**
 * Performs a number of schema normalization actions.
 */
export function normalizeSchema(): PipelineAction {
    const actions = [
        implementMissingBaseDeclarations(),
        flattenExtensionTypes(),
        implementMissingInterfaceFields(),
    ];

    return {
        name: "Normalize Schema",
        async execute(ctx) {
            for (const action of actions) {
                await action.execute(ctx);
            }
        },
    };
}