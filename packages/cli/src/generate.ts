import { DocumentNode, Kind, ObjectTypeDefinitionNode, print, TypeNode } from "graphql";
import { Project, InterfaceDeclaration, SourceFile, PropertySignature, FunctionDeclaration, VariableDeclarationKind } from "ts-morph";
import type { Mutable } from "./parser";


const BUILTIN_SCALARS: Record<string, string> = {
    ID: "string",
    String: "string",
    Boolean: "boolean",
    Int: "number",
    Float: "number",
};

const MONIQL_SCALARS: Record<string, string> = {
    ObjectID: "ObjectId",
    Email: "string",
    DateTime: "Date",
    Date: "Date",
};


export class Generator {

    /** The Typescript source file that we're generating. */
    private tsFile: SourceFile;

    /** TS interface for GraphQL scalar types. */
    private gqlScalars: InterfaceDeclaration;

    /** The getDbCollections method. */
    private dbCollectionsMethod: FunctionDeclaration;

    /** The CollectionsMap type. */
    private dbCollectionsMapType: InterfaceDeclaration;

    constructor(
        /** The AST of the GraphQL schema. */
        private ast: Mutable<DocumentNode>,
        /** The options passed into the generator by the CLI config. */
        private options: {} = {},
    ) {
        // create the TS Morph project and file that we'll write to
        const project = new Project();
        const tsFile = this.tsFile = project.createSourceFile("schema.ts", "", { overwrite: true });

        // add supporting types
        tsFile.addTypeAlias({ name: "Maybe<T>", type: "T | null" });
        tsFile.addTypeAlias({ name: "Ctx", type: "{ db: CollectionsMap }" });
        tsFile.addTypeAlias({ name: "ResolverFn<S, A, R>", type: "(source: S, args: A, context: Ctx) => R | Promise<R>" });

        // create an interface for the GraphQL scalar types
        this.gqlScalars = tsFile.addInterface({
            docs: ["All built-in and custom scalars, mapped to their actual values."],
            name: "Scalars",
            isExported: true,
        });

        for (const [name, type] of Object.entries(BUILTIN_SCALARS)) {
            this.gqlScalars.addProperty({
                name,
                type,
            });
        }

        for (const [name, type] of Object.entries(MONIQL_SCALARS)) {
            this.gqlScalars.addProperty({
                name,
                type,
            });
        }

        // TODO: add custom scalars

        // create the getDbCollections method
        this.dbCollectionsMethod = tsFile.addFunction({
            docs: ["Provides the database collections as an object and ensures indexes are created."],
            name: "getDbCollections",
            returnType: "Promise<{ [name: string]: Collection }>",
            isAsync: true,
            isExported: true,
            parameters: [
                {
                    name: "db",
                    type: "Db",
                },
            ],
        });
        this.dbCollectionsMethod.addStatements([
            `const collections: Partial<CollectionsMap> = {};`,
        ]);

        this.dbCollectionsMapType = tsFile.addInterface({
            name: "CollectionsMap",
            isExported: true,
        });

        // add import for the MongoDB client and the ObjectId, Collection, and Db types
        tsFile.addImportDeclaration({
            namedImports: [
                "MongoClient",
                { name: "ObjectId", isTypeOnly: true },
                { name: "Collection", isTypeOnly: true },
                { name: "Db", isTypeOnly: true },
            ],
            moduleSpecifier: "mongodb",
        });


        // begin visiting the AST
        for (const definition of ast.definitions) {
            switch (definition.kind) {
                case "ObjectTypeDefinition":
                    this.processObjectType(definition);
                    break;
            }
        }

        // wrap up the getDbCollections method
        this.dbCollectionsMethod.addStatements([
            `return collections as CollectionsMap;`,
        ]);
    }

    /** Gets the Typescript equivalent for the given GraphQL type node. */
    private getTsType(type: Mutable<TypeNode>): string {
        let str = "";
        let open = 0;
        let nullable = true;

        while (true) {
            // move along if we're at a non-null type
            if (type.kind === Kind.NON_NULL_TYPE) {
                type = type.type;
                nullable = false;
                continue;
            }

            // whatever type is next, wrap it in a Maybe - it's not a non-null type
            if (nullable) {
                str += "Maybe<";
                open++;
            } else {
                nullable = true;
            }

            // if we're at a list type, then we need to wrap it in an Array
            if (type.kind === Kind.LIST_TYPE) {
                str += "Array<";
                open++;
                type = type.type;
                continue;
            }

            // if we're here, then we're at a named type
            const name = type.name.value;
            if (BUILTIN_SCALARS[name] || MONIQL_SCALARS[name]) {
                str += `Scalars["${name}"]`;
            } else {
                str += name;
            }

            break;
        }

        for (let i = 0; i < open; i++) {
            str += ">";
        }

        return str;

    }

    /**
     * Processes an object type definition. If the object type has the @doc directive, then
     * we'll create an accompanying MongoDB interface type and collection for it.
     */
    private processObjectType(obj: Mutable<ObjectTypeDefinitionNode>) {
        const { tsFile: ts, dbCollectionsMapType, dbCollectionsMethod } = this;

        let dboInterface: undefined | InterfaceDeclaration;
        obj.directives = obj.directives || [];

        let collection = "";

        // create a resolver interface for the object type
        const resolverInterface = ts.addInterface({
            docs: [`Resolver for the ${obj.name.value} object type.`],
            name: `${obj.name.value}Resolver`,
            isExported: true,
        });

        // create a default resolver for the object type that implements connection fields
        // (and any other fields that can be auto generated)
        const defaultResolver = ts.insertVariableStatement(1, {
            declarationKind: VariableDeclarationKind.Const,
            isExported: true,
            // docs: [`/** Default resolver for the ${obj.name.value} object type. */`],
            declarations: [{
                name: `${obj.name.value}DefaultResolver`,
                type: `${obj.name.value}Resolver`,
                initializer: `({}) => ({} as any)`,
            }],
        });

        // TODO: create a default resolver for the object type

        // process the directives on the object type
        const docDirectiveIndex = obj.directives.findIndex((dir) => dir.name.value === "doc");
        if (docDirectiveIndex !== -1) {
            const docDir = obj.directives[docDirectiveIndex];

            // get the DBO namespace from the TS file and create it if it doesn't exist
            dboInterface = ts.addInterface({
                docs: [obj.description?.value || ""],
                name: obj.name.value,
                isExported: true,
            });

            // does the doc directive have a collection argument?
            const collectionArg = docDir.arguments?.find((arg) => arg.name?.value === "col");
            if (collectionArg) {
                if (collectionArg.value.kind !== "StringValue") {
                    throw new Error(`The @doc directive on the ${obj.name.value} object type has an invalid collection argument.`);
                }

                collection = collectionArg.value.value;
            } else {
                collection = camelCase(obj.name.value);
            }

            // add the collection to the CollectionsMap type
            dbCollectionsMapType.addProperty({
                docs: [`Collection of ${obj.name.value} records.`],
                name: camelCase(obj.name.value),
                type: `Collection<${obj.name.value}>`,
            });

            // add the collection initialization to the getDbCollections method
            dbCollectionsMethod.addStatements([
                `collections.${camelCase(obj.name.value)} = db.collection("${collection}");`,
            ]);

            // add doc fields (id, createdAt, updatedAt) to GraphQL schema
            obj.fields = obj.fields || [];
            obj.fields.unshift({
                kind: Kind.FIELD_DEFINITION,
                description: { kind: Kind.STRING, value: "Unique identifier for the record." },
                name: { kind: Kind.NAME, value: "id" },
                type: notNullNamedType("ObjectID"),
            }, {
                kind: Kind.FIELD_DEFINITION,
                description: { kind: Kind.STRING, value: "Date and time the record was created." },
                name: { kind: Kind.NAME, value: "createdAt" },
                type: notNullNamedType("DateTime"),
            }, {
                kind: Kind.FIELD_DEFINITION,
                description: { kind: Kind.STRING, value: "Date and time the record was last updated." },
                name: { kind: Kind.NAME, value: "updatedAt" },
                type: notNullNamedType("DateTime"),
            });

            // strip the @doc directive from the object type
            obj.directives.splice(docDirectiveIndex, 1);
        }

        // process the fields on the object type
        obj.fields = obj.fields || [];
        for (let i = obj.fields.length - 1; i >= 0; i--) {
            const field = obj.fields[i];
            field.directives = field.directives || [];

            // create a DBO interface property for the field
            let dboProperty: undefined | PropertySignature;
            if (dboInterface) {
                dboProperty = dboInterface.addProperty({
                    docs: [field.description?.value || ""],
                    name: field.name.value,
                    type: this.getTsType(field.type),
                    hasQuestionToken: field.type.kind !== Kind.NON_NULL_TYPE,
                });
            }

            for (let j = field.directives.length - 1; j >= 0; j--) {
                const dir = field.directives[j];
                let removeDirective = true;

                switch (dir.name.value) {
                    case "secret":
                        // if the field has the @secret directive, then we'll remove it from the GraphQL schema
                        obj.fields.splice(i, 1);
                        break;
                    case "computed": {
                        // if the field has the @computed directive, then we'll remove it from the property
                        // on the DBO interface and add a resolver method to the resolver interface
                        dboProperty?.remove();

                        // TODO: get the arguments and build a type for them
                        const params = ts.addInterface({
                            name: `${obj.name.value}${pascalCase(field.name.value)}Args`,
                            isExported: true,
                        });

                        for (const arg of (field.arguments || [])) {
                            params.addProperty({
                                docs: [arg.description?.value || ""],
                                name: arg.name?.value || "",
                                type: this.getTsType(arg.type),
                            });
                        }

                        const returnType = this.getTsType(field.type);

                        resolverInterface.addProperty({
                            name: field.name.value,
                            type: `ResolverFn<${obj.name.value}, any, ${returnType}>`,
                        });
                        break;
                    }
                    case "unique":
                        // if the field has the @unique directive, then we'll add a unique index to the
                        // MongoDB collection for the record type via ensureIndex
                        dbCollectionsMethod.addStatements([
                            `await collections.${camelCase(obj.name.value)}.ensureIndex({ ${field.name.value}: 1 }, { unique: true });`,
                        ]);
                        break;
                    default:
                        removeDirective = false;
                }

                if (removeDirective) {
                    field.directives.splice(j, 1);
                }
            }

            // process the directives on the field
            const hasDocDirective = field.directives?.some((dir) => dir.name.value === "doc");
            if (hasDocDirective) {
                // if the field has the @doc directive, then we'll add it to the DBO interface
                if (dboInterface) {
                    dboInterface.addProperty({
                        name: field.name.value,
                        type: "any",
                    });
                }

                // remove the field from the object type
                obj.fields.splice(i, 1);
            }
        }
    }

    /**
     * Generates the Typescript code for the given GraphQL object type.
     */
    public get tsCode() {
        return this.tsFile.getFullText();
    }

    /**
     * Generates the GraphQL schema code for the given GraphQL object type.
     */
    public get graphqlSchema() {
        return print(this.ast as DocumentNode);
    }

}

/**
 * Converts the string from any case to camelCase. This is a string that starts
 * with a lowercase letter and has no spaces or special characters.
 */
function camelCase(str: string) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, "");
}

/**
 * Converts the string from any case to PascalCase. This is a string that starts
 * with an uppercase letter and has no spaces or special characters.
 */
function pascalCase(str: string) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return word.toUpperCase();
    }).replace(/\s+/g, "");
}

/**
 * Creates a NOT NULL type node using the given type name.
 */
function notNullNamedType(typeName: string): Mutable<TypeNode> {
    return {
        kind: Kind.NON_NULL_TYPE,
        type: {
            kind: Kind.NAMED_TYPE,
            name: {
                kind: Kind.NAME,
                value: typeName,
            },
        },
    };
}