import { type ASTNode, type DirectiveNode, type DocumentNode, Kind } from "graphql";
import type { PipelineContext, PipelineAction } from "./core";
import type { Mutable, TypePath } from "./types";


/**
 * Custom walker that allows walking over a Mutable AST so that we can modify it. Because this
 * walker anticipates modifications, it actually walks over the AST in reverse order. Additionally,
 * the walker provides a stack of nodes to the callback, so the callback can easily access the
 * ancestors of the current node.
 */
export function mutableWalker(ast: Mutable<DocumentNode>, cb: (stack: ReadonlyArray<Mutable<ASTNode>>, node: Mutable<ASTNode>) => void) {
    function _walk(stack: Mutable<ASTNode>[], node: Mutable<ASTNode>) {
        cb(stack, node);
        stack = [...stack, node];

        switch (node.kind) {
            case Kind.DOCUMENT:
                for (let i = node.definitions.length - 1; i >= 0; i--) {
                    _walk(stack, node.definitions[i]);
                }
                break;
            case Kind.OPERATION_DEFINITION:
                if (node.variableDefinitions) {
                    for (let i = node.variableDefinitions.length - 1; i >= 0; i--) {
                        _walk(stack, node.variableDefinitions[i]);
                    }
                }
                if (node.selectionSet) {
                    for (let i = node.selectionSet.selections.length - 1; i >= 0; i--) {
                        _walk(stack, node.selectionSet.selections[i]);
                    }
                }
                break;
            case Kind.VARIABLE_DEFINITION:
                _walk(stack, node.type);
                break;
            case Kind.SELECTION_SET:
                for (let i = node.selections.length - 1; i >= 0; i--) {
                    _walk(stack, node.selections[i]);
                }
                break;
            case Kind.FIELD:
                if (node.arguments) {
                    for (let i = node.arguments.length - 1; i >= 0; i--) {
                        _walk(stack, node.arguments[i]);
                    }
                }
                if (node.directives) {
                    for (let i = node.directives.length - 1; i >= 0; i--) {
                        _walk(stack, node.directives[i]);
                    }
                }
                break;
            case Kind.ARGUMENT:
                _walk(stack, node.value);
                break;
            case Kind.INLINE_FRAGMENT:
                if (node.directives) {
                    for (let i = node.directives.length - 1; i >= 0; i--) {
                        _walk(stack, node.directives[i]);
                    }
                }
                _walk(stack, node.selectionSet);
                break;
            case Kind.FRAGMENT_DEFINITION:
                if (node.variableDefinitions) {
                    for (let i = node.variableDefinitions.length - 1; i >= 0; i--) {
                        _walk(stack, node.variableDefinitions[i]);
                    }
                }
                _walk(stack, node.selectionSet);
                break;
            case Kind.LIST_TYPE:
                _walk(stack, node.type);
                break;
            case Kind.NON_NULL_TYPE:
                _walk(stack, node.type);
                break;
            case Kind.DIRECTIVE:
                if (node.arguments) {
                    for (let i = node.arguments.length - 1; i >= 0; i--) {
                        _walk(stack, node.arguments[i]);
                    }
                }
                break;
            case Kind.OBJECT_FIELD:
                _walk(stack, node.value);
                break;
            default: break;
        }
    }

    _walk([], ast);
}


/**
 * Retrieves each node containing the specified directive, along with the directive's
 * parameters.
 */
export function getDirectives(
    ast: Mutable<DocumentNode>,
    directive: string,
    opts: {
        /** When true, the directive will be removed from the node. */
        strip?: boolean;
        /** When provided, delimits what kinds of nodes to search for directives. */
        kinds?: Kind[];
    } = {},
) {
    const { strip, kinds } = opts;
    const encountered: {
        /** The node that contains the directive. */
        node: Mutable<ASTNode>;
        /** The directive node. */
        directive: Mutable<DirectiveNode>;
        /** The stack of ancestors of the node. */
        ancestors: ReadonlyArray<Mutable<ASTNode>>;
    }[] = [];

    mutableWalker(ast, (stack, node) => {
        // we only care about directives
        if (node.kind !== Kind.DIRECTIVE) return;

        // do we care about this directive?
        if (node.name.value !== directive) return;

        // get the parent node
        const parent = stack[stack.length - 1];

        // make sure the parent node is a kind we care about (if provided)
        if (kinds && !kinds.includes(parent.kind)) return;

        // capture the directive
        encountered.push({ node: parent, directive: node, ancestors: stack });
    });

    // if the strip option is true, remove the directives from the AST
    if (strip) {
        for (const { node } of encountered) {
            const directives = (node as { directives: Mutable<DirectiveNode[]> }).directives;
            directives.filter(d => d.name.value !== directive);
        }
    }

    return encountered.reverse();
}


/**
 * Helper function that ensures a given pipeline action comes BEFORE another action
 * and provides helpful error messages to the user if the action is not in the correct
 * order.
 */
export function checkForDependencies(ctx: PipelineContext, ...deps: string[]) {
    const callingAction = ctx.action.name;
    const index = ctx.pipelineActions.findIndex((a) => a.name === callingAction);
    for (const dep of deps) {
        const depIndex = ctx.pipelineActions.findIndex((a) => a.name === dep);
        if (depIndex === -1) {
            throw new Error(`Pipeline action "${callingAction}" requires "${dep}", but it is not included in the pipeline. Be sure to add the missing action BEFORE "${callingAction}".`);
        }
        if (depIndex > index) {
            throw new Error(`Pipeline action "${callingAction}" requires "${dep}", but it is included AFTER "${callingAction}". Be sure to add the missing action BEFORE "${callingAction}".`);
        }
    }
}

/**
 * Helper function that ensures the given pipeline action doesn't appear in the pipeline
 * more than once.
 */
export function ensureActionIsUnique(ctx: PipelineContext) {
    const callingAction = ctx.action.name;
    const occurences = ctx.pipelineActions.filter((a) => a.name === callingAction);

    if (occurences.length > 1) {
        throw new Error(`Pipeline action "${callingAction}" is included more than once in the pipeline. Be sure to remove the extra action.`);
    }
}

/**
 * Helper function that ensures that no actions of the given name(s) are included in the
 * pipeline.
 */
export function ensureActionIsNotIncluded(ctx: PipelineContext, action: string) {
    const callingAction = ctx.action.name;
    const foundIncompatible = ctx.pipelineActions.some((a) => a.name === action);

    if (foundIncompatible) {
        throw new Error(`Pipeline action "${action}" is included in the pipeline and is not compatible with "${callingAction}". Be sure to remove the incompatible action.`);
    }
}