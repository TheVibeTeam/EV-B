import axios, { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";

interface MediaData {
    title?: string;
    media?: Array<{
        type?: string;
        thumbnail?: string;
        variants?: Array<{
            resolution?: string;
            url?: string;
        }>;
        url?: string;
    }>;
    [key: string]: any;
}

export default class Twitter {
    public snap: AxiosInstance;
    public jar: CookieJar;

    constructor() {
        this.jar = new CookieJar();
        this.snap = wrapper(axios.create({
            baseURL: 'https://twittermedia.b-cdn.net',
            jar: this.jar,
            headers: {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br',
                'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'origin': 'https://snaplytics.io',
                'referer': 'https://snaplytics.io/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
            }
        }));
    }

    download(url: string): Promise<MediaData> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!/^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/\d+(\?.*)?$/.test(url)) {
                    return reject(new Error('Invalid twitter url'));
                }

                const { data } = await this.snap.get('/media', {
                    params: { link: url }
                });

                const filtered = Object.fromEntries(
                    Object.entries(data).filter(([key]) => !['cursor'].includes(key))
                );

                resolve(filtered);
            } catch (error: any) {
                reject(new Error(error.message || 'No result found'));
            }
        });
    }
}

