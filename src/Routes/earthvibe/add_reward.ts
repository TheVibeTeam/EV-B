import type { Request, Response } from 'express';
import Reward from '../../Models/Reward';

export default {
    name: 'Add Reward',
    path: '/earthvibe/reward/add',
    method: 'post',
    category: 'earthvibe',
    example: { name: 'Ayuda en asignatura', description: '...', points: 1000, category: 'Academico', imageUrl: '...' },
    parameter: ['name', 'description', 'points', 'category', 'imageUrl'],
    premium: true,
    error: false,
    logger: true,
    execution: async (req: Request, res: Response) => {
        try {
            const { name, description, points, category, imageUrl } = req.body;
            if (!name || !description || !points || !category) {
                return res.status(400).json({ status: false, msg: 'Faltan datos requeridos' });
            }
            const reward = await Reward.create({ name, description, points, category, imageUrl });
            res.json({ status: true, msg: 'Premio creado', data: reward });
        } catch (error) {
            res.status(500).json({ status: false, msg: 'Error en el servidor', error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
};
