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
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        }));
    }

    private extractData(html: string): Media[] {
        const $ = cheerio.load(html);
        const results: Media[] = [];

        $('ul.download-box li').each((index, element) => {
            const thumb = $(element).find('.download-items__thumb img').attr('src');
            const options: Option[] = [];
            const downloadLink = $(element).find('.download-items__btn a').attr('href');

            $(element).find('.photo-option select option').each((i, opt) => {
                const res = $(opt).text();
                const url = $(opt).attr('value');
                if (res && url) {
                    options.push({ res, url });
                }
            });

            results.push({
                thumb,
                options,
                download: downloadLink
            });
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
                    { headers: formDataVerify.getHeaders() }
                );

                const token = verifyResponse.data.token;
                if (!token) {
                    return reject(new Error('Failed to get verification token'));
                }

                // Step 2: Search for media
                const formDataSearch = new FormData();
                formDataSearch.append('q', url);
                formDataSearch.append('t', 'media');
                formDataSearch.append('lang', 'id');
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
                            'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
                            'sec-ch-ua-mobile': '?1',
                            'sec-ch-ua-platform': '"Android"',
                            'sec-fetch-dest': 'empty',
                            'sec-fetch-mode': 'cors',
                            'sec-fetch-site': 'same-site'
                        }
                    }
                );

                const media = this.extractData(searchResponse.data.data);

                resolve({ media });
            } catch (error: any) {
                reject(new Error(error.response?.data || error.message));
            }
        });
    }
}
