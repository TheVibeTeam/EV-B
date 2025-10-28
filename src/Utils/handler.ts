import path from 'path';
import Loader from './System/loader';
import Config from './System/config';
import Func from './utils';
import express, { Request, Response, NextFunction, Router } from 'express';
import { Server } from 'socket.io';

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

}