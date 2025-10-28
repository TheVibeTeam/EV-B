import type { Request, Response } from 'express';

export default {
    name: 'Apuesta',
    path: '/casino/apostar',
    method: 'get',
    category: 'casino',
    example: { cantidad: '100', juego: 'blackjack' },
    parameter: ['cantidad', 'juego'],
    premium: false,
    error: false,
    logger: true,
    requires: (req: Request, res: Response, next: Function) => {
        if (!req.query.juego) {
            return res.json({ status: false, msg: 'Falta el juego.' });
        }
        next();
    },
    validator: (req: Request, res: Response, next: Function) => {
        if (isNaN(Number(req.query.cantidad))) {
            return res.json({ status: false, msg: 'Cantidad debe ser numérica' });
        }
        next();
    },
    execution: (req: Request, res: Response) => {
        const { cantidad, juego } = req.query;
        res.json({
            status: true,
            msg: `Apostaste S/ ${cantidad} en ${juego}`
        });
    }

}