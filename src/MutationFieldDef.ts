// import { Kind } from "graphql";
// import { FieldDef } from "./Fields";
// import { ObjectBaseDef } from "./ObjectBaseDef";

// /**
//  * Defines a mutation that can be performed via the API.
//  */
// export class MutationDef extends FieldDef {

//     constructor(
//         /** The name of the mutation. */
//         name: string,
//         /** Description of the mutation. */
//         desc: string = "",
//         /** 
//          * Should an input type be created for this mutation? Or should it always
//          * use individual arguments? The default is to create an input type once the
//          * mutation has more than one argument.
//          */
//         public inputMode: "auto" | "args" | "input" = "auto",
//     ) {
//         super(name, desc);
//     }

//     public override __build(ctx: BuildCtx, parent: ObjectBaseDef) {

//     }

// }