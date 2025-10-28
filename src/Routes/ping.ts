import type { Request, Response } from 'express';

export default {
    name: 'Ping',
    path: '/ping',
    method: 'get',
    category: 'health',
    example: {},
    parameter: [],
    premium: false,
    error: false,
    logger: false,
    execution: (req: Request, res: Response) => {
        res.json({
            status: true,
            msg: 'pong',
            timestamp: Date.now(),
            uptime: process.uptime()
        });
    }
};
