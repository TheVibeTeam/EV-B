export interface User {
    id: string;
    name: string;
    email: string;
    createdAt: string;
}

export interface QueryResolvers {
    users: () => Promise<User[]>;
    user: (_: unknown, args: { id: string }) => Promise<User | null>;
}

export interface MutationResolvers {
    createUser: (_: unknown, args: { name: string; email: string }) => Promise<User>;
}

export interface Resolvers {
    Query: QueryResolvers;
    Mutation: MutationResolvers;
}
