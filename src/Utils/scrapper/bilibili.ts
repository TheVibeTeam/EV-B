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
    bvid?: string;
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
        this.baseUrl = 'https://www.bilibili.com';
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({
            jar: this.jar,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'DNT': '1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        }));
    }

    download(url: string): Promise<Result> {
        return new Promise(async (resolve, reject) => {
            try {
                // Extract video ID - support both numeric (AID) and BV format
                const numericMatch = /\/video\/(\d+)/.exec(url);
                const bvMatch = /\/video\/(BV[a-zA-Z0-9]+)/.exec(url);

                const aid = numericMatch?.[1];
                const bvid = bvMatch?.[1];

                if (!aid && !bvid) return reject(new Error('Video ID not found'));

                // Determine if it's bilibili.com or bilibili.tv
                const isBilibiliCN = url.includes('bilibili.com');
                const isBilibiliTV = url.includes('bilibili.tv');

                let title, description, type, cover, duration;
                let likes, views, coins, favorites, shares, comments, danmaku;
                let videos: Quality[] = [];
                let audios: AudioResource[] = [];

                if (isBilibiliTV && aid) {
                    // Bilibili.tv flow (numeric IDs)
                    const pageHtml = await this.client.get(url).then(res => res.data);
                    const $ = cheerio.load(pageHtml);

                    title = $('meta[property="og:title"]').attr('content')?.split('|')[0]?.trim();
                    description = $('meta[property="og:description"]').attr('content');
                    type = $('meta[property="og:video:type"]').attr('content');
                    cover = $('meta[property="og:image"]').attr('content');
                    duration = $('meta[property="og:video:duration"]').attr('content');

                    likes = $('.interactive__btn.interactive__like .interactive__text').text().trim();
                    views = $('.bstar-meta__tips-left .bstar-meta-text').first().text().replace(/Ditonton|Views?/gi, '').trim();
                    coins = $('.interactive__btn.interactive__coin .interactive__text').text().trim();
                    favorites = $('.interactive__btn.interactive__favorite .interactive__text').text().trim();
                    shares = $('.interactive__btn.interactive__share .interactive__text').text().trim();
                    comments = $('.comment-placeholder__text').text().trim();
                    danmaku = $('.bstar-meta__tips-left .bstar-meta-text').eq(1).text().trim();

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

                    videos = (playResponse?.data?.playurl?.video || []).map((v: any) => ({
                        desc: v.stream_info?.desc_words || v.stream_info?.quality_desc,
                        quality: v.stream_info?.quality,
                        format: v.video_resource?.mime_type?.split('/')?.[1] || 'mp4',
                        url: v.video_resource?.url,
                        backup: v.video_resource?.backup_url
                    })).filter((v: Quality) => v.url);

                    audios = (playResponse?.data?.playurl?.audio_resource || []).map((a: any) => ({
                        quality: a.quality,
                        format: a.mime_type?.split('/')?.[1] || 'mp3',
                        url: a.url,
                        backup: a.backup_url
                    })).filter((a: AudioResource) => a.url);

                } else if (isBilibiliCN && bvid) {
                    // Bilibili.com flow (BV IDs) - simplified, may need API access
                    const pageHtml = await this.client.get(url, {
                        headers: {
                            'Origin': 'https://www.bilibili.com',
                            'Referer': 'https://www.bilibili.com/'
                        }
                    }).then(res => res.data);

                    const $ = cheerio.load(pageHtml);

                    // Try to extract from page metadata
                    title = $('meta[property="og:title"]').attr('content')?.split('_')[0]?.trim() ||
                        $('h1').first().text().trim();
                    description = $('meta[property="og:description"]').attr('content') ||
                        $('meta[name="description"]').attr('content');
                    cover = $('meta[property="og:image"]').attr('content');

                    // Note: Bilibili.com requires more complex scraping/API calls
                    // This is a basic implementation - full support may need bilibili API credentials
                    return reject(new Error('Bilibili.com (BV IDs) requires API access. Please use bilibili.tv links or contact support.'));
                }

                resolve({
                    info: {
                        aid,
                        bvid,
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
