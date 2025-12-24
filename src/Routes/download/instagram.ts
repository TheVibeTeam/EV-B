import type { Request, Response } from 'express';
import Instagram from '../../Utils/scrapper/instagram';

export default {
    name: 'Download Instagram Media',
    path: '/download/instagram',
    method: 'post',
    category: 'download',
    example: {
        url: '/download/instagram',
        body: { url: 'https://www.instagram.com/p/DHe7V9KBxYO/' }
    },
    parameter: ['url'],
    premium: false,
    error: false,
    logger: true,
    requires: (req: Request, res: Response, next: Function) => {
        const { url } = req.body;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ status: false, msg: 'La URL es requerida' });
        }
        next();
    },
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;
        try {
            const scraper = new Instagram();
            const result = await scraper.download(url);

            if (!result || !result.media || result.media.length === 0) {
                return res.status(404).json({
                    status: false,
                    msg: 'No se encontró contenido para descargar.'
                });
            }

            return res.status(200).json({
                status: true,
                data: result
            });

        } catch (e: any) {
            console.error('Error en descarga de Instagram:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Error interno del servidor.'
            });
        }
    }
};
