import type { Request, Response } from 'express';
import TikTokScraper from '../../Utils/scrapper/tiktok';

export default {
  name: 'Download TikTok Media',
  path: '/download/tiktok',
  method: 'post',
  category: 'download',
  example: {
    url: '/download/tiktok',
    body: { url: 'https://www.tiktok.com/@user/video/123' }
  },
  parameter: ['url'],
  premium: false,
  error: false,
  logger: true,
  requires: (req: Request, res: Response, next: Function) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ status: false, msg: 'url es requerido' });
    }
    next();
  },
  execution: async (req: Request, res: Response) => {
    const { url } = req.body;
    try {
      const result = await TikTokScraper.download(url);
      if (!result.status || !result.data) {
        return res.status(404).json({ status: false, msg: 'No se encontró contenido para descargar' });
      }
      // Si es imagen
      if (result.data.media?.type === 'image' && Array.isArray(result.data.media.images)) {
        return res.json({ status: true, type: 'images', urls: result.data.media.images });
      }
      // Si es video
      if (result.data.media?.type === 'video' && result.data.media.nowatermark?.play) {
        const urls = [];
        if (result.data.media.nowatermark.hd?.play) urls.push(result.data.media.nowatermark.hd.play);
        else urls.push(result.data.media.nowatermark.play);
        return res.json({ status: true, type: 'video', urls });
      }
      return res.status(404).json({ status: false, msg: 'No se encontró contenido para descargar' });
    } catch (e) {
      return res.status(500).json({ status: false, msg: 'Error al obtener el contenido' });
    }
  }
};
