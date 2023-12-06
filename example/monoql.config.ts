import { createSchema } from "monoql";

const schema = createSchema({
    outDir: "./src/monoql",
});

const Timestamps = schema.interface({ name: "Timestamps", abstract: true })
    .datetime({
        name: "createdAt",
        docs: "Date/time the object was created",
        readonly: true,
        sortable: true,
    })
    .datetime({
        name: "updatedAt",
        docs: "Date/time the object was last updated",
        readonly: true,
        sortable: true,
    })

const User = schema
    .model({
        name: "User",
        desc: "An authenticated entity in the system",
    })
    .implements(Timestamps)
    .string({ name: "firstName", desc: "First name of the user" })
    .string({ name: "lastName", desc: "Last name of the user" })
    .email({ name: "email", desc: "Email address of the user", unique: true, sortable: true })
    .string({ name: "password", desc: "Password of the user", internal: true })
// .hasMany({ name: "posts", type: () => Post, foreign: "authorId" })

const PostGenre = schema.enum({ name: "PostGenre", desc: "Determines post genre" })
    .value({ name: "SCIFI", as: "scifi" })
    .value({ name: "FANTASY" })

const Post = schema.model({ name: "Post" })
    .implements(Timestamps)
    .list()
    .string({ name: "title", as: "name", searchable: true, sortable: true })
    .field({ name: "genre", type: PostGenre, sortable: true })
    .field({ name: "genre2", type: PostGenre, nullable: true })
// .belongsTo({ name: "author", type: User, local: "authorId" })


schema.generate();