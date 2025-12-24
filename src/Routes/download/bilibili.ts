import type { Request, Response } from 'express';
import Bilibili from '../../Utils/scrapper/bilibili';

export default {
    name: 'Download Bilibili Media',
    path: '/download/bilibili',
    method: 'post',
    category: 'download',
    example: {
        url: '/download/bilibili',
        body: { url: 'https://www.bilibili.tv/video/4793817472438784' }
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
            const scraper = new Bilibili();
            const result = await scraper.download(url);

            if (!result) {
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
            console.error('Error en descarga de Bilibili:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Error interno del servidor.'
            });
        }
    }
};
