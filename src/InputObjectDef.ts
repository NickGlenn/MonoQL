import { Kind } from "graphql";
import { ObjectBaseDef } from "./ObjectBaseDef";

/**
 * Defines an input object type.
 */
export class InputObjectDef extends ObjectBaseDef {

    constructor(
        /** The name of the object type. */
        name: string,
        /** Description of the object type. */
        desc: string = "",
    ) {
        super(!name.endsWith("Input") ? name + "Input" : name, desc);
    }

    /** Generates the API schema for this type. */
    public override __generateApi(ctx: BuildCtx): void {
        const fields = Object.values(this.fields);
        if (ctx.userAst?.definitions.find(d => "name" in d && d.name!.value === this.name)) {
            throw new Error(`Unable to create object type "${this.name}" because it already exists in your GraphQL schema.`);
        }

        ctx.genAst.definitions.push({
            kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
            name: { kind: Kind.NAME, value: this.name },
            description: { kind: Kind.STRING, value: this.desc },
            directives: [],
            // fields: fields.map(f => {
            //     const gql = f.getApiField(ctx, this);
            //     if (!gql) throw new Error(`Unable to create field "${f.name}" on object type "${this.name}".`);



            //     return gql;
            // }),
        });

    }

    /** Builds the object type. */
    public override __generateImpl(ctx: BuildCtx) {
        // purposely do nothing
    }

}