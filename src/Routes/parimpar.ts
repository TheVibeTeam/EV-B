import type { Request, Response } from 'express';

export default {
    name: 'ParImpar',
    path: '/casino/parimpar',
    method: 'post',
    category: 'casino',
    example: { apuesta: 'par', cantidad: '50' },
    parameter: ['apuesta', 'cantidad'],
    premium: false,
    error: false,
    logger: true,
    requires: (req: Request, res: Response, next: Function) => {
        if (!req.body.apuesta || !req.body.cantidad) {
            return res.json({ status: false, msg: 'Faltan datos de apuesta.' });
        }
        next();
    },
    validator: (req: Request, res: Response, next: Function) => {
        if (!['par', 'impar'].includes(req.body.apuesta)) {
            return res.json({ status: false, msg: 'La apuesta debe ser "par" o "impar".' });
        }
        if (isNaN(Number(req.body.cantidad))) {
            return res.json({ status: false, msg: 'Cantidad debe ser numérica.' });
        }
        next();
    },
    execution: (req: Request, res: Response) => {
        const { apuesta, cantidad } = req.body;
        const resultado = Math.random() < 0.5 ? 'par' : 'impar';
        const ganancia = resultado === apuesta ? Number(cantidad) * 2 : 0;
        res.json({
            status: true,
            resultado,
            ganancia,
            msg: ganancia > 0 ? `¡Ganaste S/ ${ganancia}!` : 'No ganaste esta vez.'
        });
    }
}
