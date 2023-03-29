import { ensureActionIsNotIncluded, ensureActionIsUnique } from "../utils";
import { PipelineAction } from "../core";
import { flattenExtensionTypes, FlattenExtensionTypesOptions } from "./flattenExtensionTypes";
import { implementMissingBaseDeclarations } from "./implementMissingBaseDeclarations";
import { implementMissingInterfaceFields } from "./implementMissingInterfaceFields";

export interface NormalizeSchemaOptions {
    /**
     * Passes options along to the `implementMissingBaseDeclarations` action. If set to `false`,
     * then this action will not be executed by the `normalizeSchema` action.
     */
    implementMissingBaseDeclarations?: false;
    /**
     * Passes options along to the `flattenExtensionTypes` action. If set to `false, then
     * this action will not be executed by the `normalizeSchema` action.
     */
    flattenExtensionTypes?: false | FlattenExtensionTypesOptions;
    /**
     * Passes options along to the `implementMissingInterfaceFields` action. If set to `false, then
     * this action will not be executed by the `normalizeSchema` action.
     */
    implementMissingInterfaceFields?: false;
}

/**
 * Performs several pre-process transformations to create a flatter, simpler schema for
 * further actions to operate on. This also includes a few quality of life improvements
 * for SDL authors, such as adding missing base definitions for extension types or adding
 * missing interface fields.
 */
export function normalizeSchema({
    implementMissingBaseDeclarations: opts1,
    flattenExtensionTypes: opts2,
    implementMissingInterfaceFields: opts3,
}: NormalizeSchemaOptions = {}): PipelineAction {
    const _actions: PipelineAction[] = [];

    if (opts1 !== false) {
        _actions.push(implementMissingBaseDeclarations());
    }

    if (opts2 !== false) {
        _actions.push(flattenExtensionTypes(opts2));
    }

    if (opts3 !== false) {
        _actions.push(implementMissingInterfaceFields());
    }

    return {
        name: "Normalize Schema",
        validate(ctx) {
            ensureActionIsUnique(ctx);

            // make sure this is the first action in the pipeline and warn otherwise
            if (ctx.pipelineActions[0] !== this) {
                console.warn(`The "${this.name}" action should be the first action in the pipeline. It is recommended that you move this action to the top of the pipeline.`);
            }

            // make sure that the following actions are not present in the pipeline
            for (const action of _actions) {
                ensureActionIsNotIncluded(ctx, action.name);
            }
        },
        execute(ctx) {
            for (const action of _actions) {
                action.execute(ctx);
            }
        },
    };
}