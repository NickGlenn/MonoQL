import { ObjectBaseDef } from "./ObjectBaseDef";

/**
 * Defines a more generic object type that can be used as a part of a model or other
 * object. Objects can be shared my multiple parent types, but are never stored
 * directly at the top level of the database.
 */
export class ObjectDef extends ObjectBaseDef {

    constructor(
        /** The name of the object type. */
        name: string,
        /** Description of the object type. */
        desc: string = "",
    ) {
        super(name, desc);
    }

}