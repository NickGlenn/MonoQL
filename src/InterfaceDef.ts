import { type InterfaceTypeDefinitionNode, Kind } from "graphql";
import { ObjectBaseDef } from "./ObjectBaseDef";

/**
 * Provides the definition of an MonoQL interface type.
 */
export class InterfaceDef extends ObjectBaseDef {

    constructor(
        /** The name of the interface type. */
        name: string,
        /** Description of the interface type. */
        desc: string = "",
        /** Is this an abstract interface? */
        public readonly abstract: boolean = false,
    ) {
        super(name, desc);
    }

    /** Generates the GraphQL AST for the interface type. */
    public override __generateApi({ genAst }: BuildCtx): void {
        if (!this.abstract) {
            const gql: Mutable<InterfaceTypeDefinitionNode> = {
                kind: Kind.INTERFACE_TYPE_DEFINITION,
                name: { kind: Kind.NAME, value: this.name },
                description: { kind: Kind.STRING, value: this.desc },
                fields: [],
                directives: [],
                interfaces: this.interfaces.filter(i => !i.abstract).map(i => ({
                    kind: Kind.NAMED_TYPE,
                    name: { kind: Kind.NAME, value: i.name },
                })),
            };

            genAst.definitions.push(gql);
        }
    }

    /** Builds the interface type. */
    public override __generateImpl({ genAst, output }: BuildCtx) {
        // // create a Typescript interface for the object type
        // const iface = output.addInterface({
        //     docs: [this.desc],
        //     name: this.name,
        //     isExported: true,
        //     extends: this.interfaces.map(i => i.name),
        // });
    }

}