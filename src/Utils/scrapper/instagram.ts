import axios, { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import * as cheerio from "cheerio";
import FormData from "form-data";

interface Option {
    res: string;
    url: string;
}

interface Media {
    thumb?: string;
    options: Option[];
    download?: string;
}

interface Result {
    media: Media[];
}

export default class Instagram {
    public baseUrl: string;
    public apiUrl: string;
    public jar: CookieJar;
    public client: AxiosInstance;

    constructor() {
        this.baseUrl = 'https://savevid.net';
        this.apiUrl = 'https://v3.savevid.net';
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({
            jar: this.jar,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'es-ES,es;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site'
            }
        }));
    }

    private extractData(html: string): Media[] {
        const $ = cheerio.load(html);
        const results: Media[] = [];

        $('ul.download-box li').each((index, element) => {
            const thumb = $(element).find('.download-items__thumb img').attr('src');
            const options: Option[] = [];
            const downloadLink = $(element).find('.download-items__btn:not(.dl-thumb) a').attr('href');

            $(element).find('.photo-option select option').each((i, opt) => {
                const res = $(opt).text();
                const url = $(opt).attr('value');
                if (res && url) {
                    options.push({ res, url });
                }
            });

            // Also check for direct video download button
            $(element).find('.download-items__btn a').each((i, link) => {
                const href = $(link).attr('href');
                const text = $(link).text().trim();
                if (href && text && !options.some(o => o.url === href)) {
                    options.push({ res: text || 'Download', url: href });
                }
            });

            if (thumb || options.length > 0 || downloadLink) {
                results.push({
                    thumb,
                    options,
                    download: downloadLink
                });
            }
        });

        return results;
    }

    download(url: string): Promise<Result> {
        return new Promise(async (resolve, reject) => {
            try {
                // Step 1: Get verification token
                const formDataVerify = new FormData();
                formDataVerify.append('url', url);

                const verifyResponse = await this.client.post(
                    `${this.baseUrl}/api/userverify`,
                    formDataVerify,
                    {
                        headers: {
                            ...formDataVerify.getHeaders(),
                            'origin': this.baseUrl,
                            'referer': `${this.baseUrl}/`
                        }
                    }
                );

                const token = verifyResponse.data.token;
                if (!token) {
                    return reject(new Error('Failed to get verification token'));
                }

                // Step 2: Search for media with exact headers from DevTools
                const formDataSearch = new FormData();
                formDataSearch.append('q', url);
                formDataSearch.append('t', 'media');
                formDataSearch.append('lang', 'es');
                formDataSearch.append('v', 'v2');
                formDataSearch.append('cftoken', token);

                const searchResponse = await this.client.post(
                    `${this.apiUrl}/api/ajaxSearch`,
                    formDataSearch,
                    {
                        headers: {
                            ...formDataSearch.getHeaders(),
                            'authority': 'v3.savevid.net',
                            'origin': this.baseUrl,
                            'referer': `${this.baseUrl}/`,
                            'priority': 'u=1, i'
                        }
                    }
                );

                if (!searchResponse.data || !searchResponse.data.data) {
                    return reject(new Error('No data returned from API'));
                }

                const media = this.extractData(searchResponse.data.data);

                if (media.length === 0) {
                    return reject(new Error('No media found. The post may be private or unavailable.'));
                }

                resolve({ media });
            } catch (error: any) {
                const errorMsg = error.response?.data?.error ||
                    error.response?.data?.message ||
                    error.message;
                reject(new Error(errorMsg || 'Failed to download Instagram media'));
            }
        });
    }
}
