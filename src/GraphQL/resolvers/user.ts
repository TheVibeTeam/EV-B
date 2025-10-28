import { User, Resolvers } from '../types/types';

export default {
    name: 'User GraphQL API',
    description: 'User management through GraphQL',
    types: ['User', 'Query', 'Mutation'],
    file: 'resolvers/user.ts',
    resolvers: {
        Query: {
            users: async (): Promise<User[]> => {
                return [];
            },
            user: async (_: unknown, { id }: { id: string }): Promise<User | null> => {
                return null;
            }
        },
        Mutation: {
            createUser: async (_: unknown, { name, email }: { name: string; email: string }): Promise<User> => {
                return {
                    id: '1',
                    name,
                    email,
                    createdAt: new Date().toISOString()
                };
            }
        }
    } as Resolvers
};
