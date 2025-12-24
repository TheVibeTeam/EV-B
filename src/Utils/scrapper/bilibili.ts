import axios, { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import * as cheerio from "cheerio";

interface Quality {
    desc: string;
    quality: number;
    format: string;
    url: string;
    backup?: string[];
}

interface AudioResource {
    quality: number;
    format: string;
    url: string;
    backup?: string[];
}

interface VideoInfo {
    aid?: string;
    title?: string;
    desc?: string;
    type?: string;
    cover?: string;
    duration?: string;
}

interface Stats {
    views?: string;
    likes?: string;
    coins?: string;
    favorites?: string;
    shares?: string;
    comments?: string;
    danmaku?: string;
}

interface Result {
    info: VideoInfo;
    stats: Stats;
    videos: Quality[];
    audios: AudioResource[];
}

export default class Bilibili {
    public baseUrl: string;
    public jar: CookieJar;
    public client: AxiosInstance;

    constructor() {
        this.baseUrl = 'https://www.bilibili.tv';
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({
            jar: this.jar,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'DNT': '1',
                'Origin': 'https://www.bilibili.tv',
                'Referer': 'https://www.bilibili.tv/'
            }
        }));
    }

    download(url: string): Promise<Result> {
        return new Promise(async (resolve, reject) => {
            try {
                const aid = /\/video\/(\d+)/.exec(url)?.[1];
                if (!aid) return reject(new Error('Video ID not found'));

                // Get page HTML to extract metadata
                const pageHtml = await this.client.get(url).then(res => res.data);
                const $ = cheerio.load(pageHtml);

                // Extract meta information
                const title = $('meta[property="og:title"]').attr('content')?.split('|')[0]?.trim();
                const description = $('meta[property="og:description"]').attr('content');
                const type = $('meta[property="og:video:type"]').attr('content');
                const cover = $('meta[property="og:image"]').attr('content');
                const duration = $('meta[property="og:video:duration"]').attr('content');

                // Extract stats from page
                const likes = $('.interactive__btn.interactive__like .interactive__text').text().trim();
                const views = $('.bstar-meta__tips-left .bstar-meta-text').first().text().replace(/Ditonton|Views?/gi, '').trim();
                const coins = $('.interactive__btn.interactive__coin .interactive__text').text().trim();
                const favorites = $('.interactive__btn.interactive__favorite .interactive__text').text().trim();
                const shares = $('.interactive__btn.interactive__share .interactive__text').text().trim();
                const comments = $('.comment-placeholder__text').text().trim();
                const danmaku = $('.bstar-meta__tips-left .bstar-meta-text').eq(1).text().trim();

                // Get video playback URLs
                const playResponse = await this.client.get('https://api.bilibili.tv/intl/gateway/web/playurl', {
                    params: {
                        's_locale': 'id_ID',
                        'platform': 'web',
                        'aid': aid,
                        'qn': '64',
                        'type': '0',
                        'device': 'wap',
                        'tf': '0',
                        'spm_id': 'bstar-web.ugc-video-detail.0.0',
                        'from_spm_id': 'bstar-web.homepage.trending.all',
                        'fnval': '16',
                        'fnver': '0',
                    }
                }).then(res => res.data);

                // Extract all available video qualities
                const videos: Quality[] = (playResponse?.data?.playurl?.video || []).map((v: any) => ({
                    desc: v.stream_info?.desc_words || v.stream_info?.quality_desc,
                    quality: v.stream_info?.quality,
                    format: v.video_resource?.mime_type?.split('/')?.[1] || 'mp4',
                    url: v.video_resource?.url,
                    backup: v.video_resource?.backup_url
                })).filter((v: Quality) => v.url);

                // Extract all available audio resources
                const audios: AudioResource[] = (playResponse?.data?.playurl?.audio_resource || []).map((a: any) => ({
                    quality: a.quality,
                    format: a.mime_type?.split('/')?.[1] || 'mp3',
                    url: a.url,
                    backup: a.backup_url
                })).filter((a: AudioResource) => a.url);

                resolve({
                    info: {
                        aid,
                        title,
                        desc: description,
                        type,
                        cover,
                        duration
                    },
                    stats: {
                        views,
                        likes,
                        coins,
                        favorites,
                        shares,
                        comments,
                        danmaku
                    },
                    videos,
                    audios
                });
            } catch (error: any) {
                reject(new Error(error.message));
            }
        });
    }
}
