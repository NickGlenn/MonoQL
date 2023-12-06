import { ScalarDef } from "./ScalarDef";


/**
 * The `ID` scalar type represents a unique identifier for a model (or other
 * object). It corresponds to the `ObjectId` type in MongoDB.
 */
export const ID = new ScalarDef(
    "ID",
    "ObjectId",
    "Represents a unique identifier, stored as a BSON ObjectId.",
);

/**
 * The `Boolean` scalar type represents a boolean value.
 */
export const Boolean = new ScalarDef(
    "Boolean",
    "boolean",
    "Represents a boolean value."
);

/**
 * The `Int` scalar type represents a signed 32-bit integer value.
 */
export const Int = new ScalarDef(
    "Int",
    "number",
    "Represents a signed 32-bit integer value."
);

/**
 * The `Float` scalar type represents a signed double-precision floating-point
 */
export const Float = new ScalarDef(
    "Float",
    "number",
    "Represents a signed double-precision floating-point value."
);

/**
 * The `Uint` scalar type represents an unsigned 32-bit integer value.
 */
export const Uint = new ScalarDef(
    "Uint",
    "number",
    "Represents an unsigned 32-bit integer value."
);

/**
 * The `String` scalar type represents a string value.
 */
export const String = new ScalarDef(
    "String",
    "string",
    "Represents a string value."
);

/**
 * The `Date` scalar type represents a date value, represented as a string in
 * ISO 8601 format. This will automatically omit the time component of the
 * date when stored in the database.
 */
export const Date = new ScalarDef(
    "Date",
    "Date",
    "Represents a date value, represented as a string in ISO 8601 format."
);

/**
 * The `DateTime` scalar type represents a date and time value, represented as
 * a string in ISO 8601 format.
 */
export const DateTime = new ScalarDef(
    "DateTime",
    "Date",
    "Represents a date and time value, represented as a string in ISO 8601 format."
);

/**
 * The `Email` scalar type represents a string that conforms to RFC 5322. This handles
 * basic validation of email addresses and ensures that emails are passed in lower case
 * format with whitespace trimmed.
 */
export const Email = new ScalarDef(
    "Email",
    "string",
    "A string that conforms to RFC 5322."
);

/**
 * The `JSON` scalar type represents any JSON compatible value. This includes null,
 * boolean, number, string, array of any previously mentioned type, and string-keyed
 * objects containing any previously mentioned type.
 */
export const Json = new ScalarDef(
    "JSON",
    "Json",
    "Represents any JSON compatible value."
);