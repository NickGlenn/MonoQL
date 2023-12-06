import { createSchema } from "monoql";

const schema = createSchema({
    outDir: "./src/monoql",
});

const Timestamps = schema.interface({ name: "Timestamps", abstract: true })
    .datetime({ name: "createdAt", readonly: true, sortable: true })
    .datetime({ name: "updatedAt", readonly: true, sortable: true })

const User = schema.model({ name: "User" })
    .implements(Timestamps)
    .string({ name: "firstName", default: "" })
    .string({ name: "lastName", default: "" })
    .email({ name: "email", unique: true, sortable: true })
    .string({ name: "password", internal: true })
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