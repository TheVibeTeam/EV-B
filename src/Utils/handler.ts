import path from 'path';
import fs from 'fs';
import Loader from './System/loader';
import Config from './System/config';
import Func from './utils';
import express, { Request, Response, NextFunction, Router } from 'express';
import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
// @ts-ignore
import { useServer } from 'graphql-ws/use/ws';
import jwt from 'jsonwebtoken';
import logger from './logger';

export default new class Handler {
    public router: Router = express.Router()


    public async routes(): Promise<Router | undefined> {
        try {
            await Loader.router(path.join(__dirname, '../Routes'));
            const routers = Object.values(Loader.plugins);
            routers.forEach((v: any) => {
                const route = v
                
                if (!route || !route.name || !route.path || !route.method || !route.execution) {
                    return
                }
                
                if (route.name) Config.routes.push({
                    category: Func.ucword(route.category),
                    base_code: Buffer.from(route.category.toLowerCase()).toString('base64'),
                    name: route.name,
                    path: route.example ? `${route.path}?${new URLSearchParams(Object.entries(route.example)).toString()}` : route.path,
                    method: route.method.toUpperCase(),
                    raw: {
                        path: route.path,
                        example: route.example || null
                    },
                    error: route.error,
                    premium: route.premium,
                    logger: route.logger || false,
                });

                const error = (route.error ? (req: Request, res: Response, next: NextFunction) => {
                    res.json({
                        creator: process.env.WEBSERVER_AUTHOR,
                        status: false,
                        msg: `Sorry, this feature is currently error and will be fixed soon`
                    });
                } : (req: Request, res: Response, next: NextFunction) => {
                    next()
                })

                const requires = (!route.requires ? (req: Request, res: Response, next: NextFunction) => {
                    const reqFn = route.method === 'get' ? 'reqGet' : 'reqPost';
                    const check = Config.status[reqFn](req, route.parameter);
                    if (!check.status) return res.json(check);
                    const reqType = route.method === 'get' ? 'query' : 'body';
                    if ('url' in req[reqType]) {
                        const isUrl = Config.status.url(req[reqType].url);
                        if (!isUrl.status)
                            return res.json(isUrl);
                        next();
                    } else next();
                } : route.requires);

                const validator = (route.validator ? route.validator : (req: Request, res: Response, next: NextFunction) => {
                    next()
                })

                if (typeof (this.router as any)[route.method] === 'function') {
                    (this.router as any)[route.method.toLowerCase()](route.path, error, requires, validator, route.execution);
                }
            })
            return this.router
        } catch (err) {
            if (err instanceof Error) {
                throw new Error(`Failed to load routers: ${err.message}`)
            }
        }
    }
    public async sockets(io: Server): Promise<void> {
        try {
            await Loader.socket(path.join(__dirname, '../Socket'));
            const sockets = Object.values(Loader.sockets);

            io.on('connection', (socket) => {
                sockets.forEach((data: any) => {
                    if (data.name) {
                        Config.sockets.push?.({
                            name: data.name,
                            description: data.description,
                            events: data.events || [],
                            file: data.file
                        });
                    }

                    if (typeof data.execution === 'function') {
                        data.execution(socket);
                    }
                });

                socket.on('disconnect', () => {})
            });
        } catch (err) {
            if (err instanceof Error) {
                throw new Error(`Failed to load sockets: ${err.message}`);
            }
        }
    };

    public async hybrid(app: express.Application, httpServer: HTTPServer): Promise<void> {
        try {
            const hybridDir = path.join(__dirname, '../Hybrid/nazishop');
            await Loader.graphqlResolvers(hybridDir);
            const { queries, mutations } = Loader.graphql;
            const loadedSchemas = new Set<string>();
            const schemaContents: string[] = [];

            const loadSchema = (schemaFile: string) => {
                if (!loadedSchemas.has(schemaFile)) {
                    const schemaPath = path.join(hybridDir, 'schemas', schemaFile);
                    if (fs.existsSync(schemaPath)) {
                        schemaContents.push(fs.readFileSync(schemaPath, 'utf-8'));
                        loadedSchemas.add(schemaFile);
                        logger.info({ schema: schemaFile }, 'Hybrid schema loaded');
                    }
                }
            };

            Object.values(queries).forEach((q: any) => { if (q.schema) loadSchema(q.schema); });
            Object.values(mutations).forEach((m: any) => { if (m.schema) loadSchema(m.schema); });

            const queryDefs: string[] = [];
            const mutationDefs: string[] = [];
            Object.values(queries).forEach((q: any) => { if (q.query) queryDefs.push(q.query); });
            Object.values(mutations).forEach((m: any) => { if (m.mutation) mutationDefs.push(m.mutation); });

            const typeDefs = `
                ${schemaContents.join('\n\n')}
                type Query { ${queryDefs.join('\n                    ')} }
                ${mutationDefs.length > 0 ? `type Mutation { ${mutationDefs.join('\n                    ')} }` : ''}
            `;

            const resolvers: any = { Query: {}, Mutation: {} };
            Object.values(queries).forEach((q: any) => {
                const queryName = q.query?.split(/[\s:(]/)[0]?.trim();
                if (queryName) resolvers.Query[queryName] = q.resolver;
            });
            Object.values(mutations).forEach((m: any) => {
                const mutationName = m.mutation?.split(/[\s:(]/)[0]?.trim();
                if (mutationName) resolvers.Mutation[mutationName] = m.resolver;
            });

            const schema = makeExecutableSchema({ typeDefs, resolvers });

            const apolloServer = new ApolloServer({
                schema,
                persistedQueries: false,
                context: ({ req }) => {
                    const token = req.headers.authorization?.replace('Bearer ', '');
                    let user = null;
                    if (token) {
                        try { user = jwt.verify(token, process.env.JWT_SECRET || 'secret'); } 
                        catch { logger.warn('Invalid JWT token'); }
                    }
                    return { req, user };
                },
                formatError: (error) => {
                    logger.error({ error: error.message }, 'GraphQL Error');
                    return error;
                },
            });

            await apolloServer.start();
            apolloServer.applyMiddleware({ app: app as any, path: '/hybrid', cors: false });

            const wsServer = new WebSocketServer({ server: httpServer, path: '/hybrid' });
            useServer({ schema }, wsServer);

            logger.info({ 
                path: apolloServer.graphqlPath,
                queries: Object.keys(queries).length,
                mutations: Object.keys(mutations).length,
                schemas: loadedSchemas.size
            }, 'Hybrid server (GraphQL + WebSocket) initialized');
        } catch (err) {
            if (err instanceof Error) {
                logger.error({ error: err.message }, 'Failed to load Hybrid');
                throw new Error(`Failed to load Hybrid: ${err.message}`);
            }
        }
    }
}