import axios, { AxiosInstance } from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";

interface Item {
    type?: string;
    name?: string;
    mediaUrl: string;
    mediaRes?: string | false;
    mediaQuality?: string;
    mediaFileSize?: string;
    mediaExtension?: string;
    mediaDuration?: string;
}

interface ApiData {
    service?: string;
    status?: string;
    message?: string;
    id?: string;
    title?: string;
    description?: string;
    imagePreviewUrl?: string;
    previewUrl?: string;
    permanentLink?: string;
    userInfo?: {
        name?: string;
        username?: string;
        userId?: string;
        userAvatar?: string;
        isVerified?: boolean;
        externalUrl?: string;
        userBio?: string;
        userCategory?: string | false;
        userPhone?: string | false;
        userEmail?: string | false;
        internalUrl?: string;
        accountCountry?: string;
        dateJoined?: string;
        dateVerified?: string | false;
    };
    mediaStats?: {
        viewsCount?: string;
        mediaCount?: string;
        followersCount?: string;
        followingCount?: string | false;
        likesCount?: string | false;
        commentsCount?: string | false;
        favouritesCount?: string | false;
        sharesCount?: string | false;
        downloadsCount?: string | false;
    };
    mediaItems?: Item[];
}

interface ApiResponse {
    api?: ApiData;
}

interface Format {
    quality?: string;
    res?: string;
    size?: string;
    format?: string;
    duration?: string;
    url?: string;
}

interface Info {
    id?: string;
    title?: string;
    desc?: string;
    thumb?: string;
    preview?: string;
    link?: string;
    service?: string;
    status?: string;
    message?: string;
}

interface Channel {
    name?: string;
    user?: string;
    id?: string;
    avatar?: string;
    verified: boolean;
    site?: string;
    bio?: string;
    category?: string | false;
    internal?: string;
    country?: string;
    joined?: string;
}

interface Stats {
    views?: string;
    vids?: string;
    subs?: string;
    following?: string | false;
    likes?: string | false;
    comments?: string | false;
    favorites?: string | false;
    shares?: string | false;
    downloads?: string | false;
}

interface Result {
    info: Info;
    channel: Channel;
    stats: Stats;
    videos: Format[];
    audios: Format[];
}

export default class YouTube {
    public baseUrl: string;
    public jar: CookieJar;
    public client: AxiosInstance;

    constructor() {
        this.baseUrl = 'https://ytdown.to';
        this.jar = new CookieJar();
        this.client = wrapper(axios.create({
            jar: this.jar,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        }));
    }

    private async getUrl(mediaUrl: string, retries: number = 10, delay: number = 1000): Promise<string | null> {
        for (let i = 0; i < retries; i++) {
            const { data } = await this.client.get(mediaUrl);
            if (data?.fileUrl) return data.fileUrl;
            await new Promise((res) => setTimeout(res, delay));
        }
        return null;
    }

    download(url: string): Promise<Result> {
        return new Promise(async (resolve, reject) => {
            if (!url) return reject(new Error("URL is required"));

            const payload = new URLSearchParams({ url });

            await this.client.post<ApiResponse>(
                `${this.baseUrl}/proxy.php`,
                payload.toString(),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        Accept: "*/*",
                        "X-Requested-With": "XMLHttpRequest",
                        Referer: `${this.baseUrl}/es2/`,
                    },
                }
            ).then(async ({ data }) => {
                const api = data?.api;
                if (!api) return reject(new Error("API response error"));

                const items = api.mediaItems ?? [];

                const vids = items.filter((i) => i.type === "Video");
                const auds = items.filter((i) => i.type === "Audio");

                const videos: Format[] = await Promise.all(
                    vids.map(async (item) => {
                        const downloadUrl = await this.getUrl(item.mediaUrl);
                        return {
                            quality: item.mediaQuality,
                            res: item.mediaRes || undefined,
                            size: item.mediaFileSize,
                            format: item.mediaExtension,
                            duration: item.mediaDuration,
                            url: downloadUrl || undefined,
                        };
                    })
                );

                const audios: Format[] = await Promise.all(
                    auds.map(async (item) => {
                        const downloadUrl = await this.getUrl(item.mediaUrl);
                        return {
                            quality: item.mediaQuality,
                            size: item.mediaFileSize,
                            format: item.mediaExtension,
                            duration: item.mediaDuration,
                            url: downloadUrl || undefined,
                        };
                    })
                );

                resolve({
                    info: {
                        id: api.id,
                        title: api.title,
                        desc: api.description,
                        thumb: api.imagePreviewUrl,
                        preview: api.previewUrl,
                        link: api.permanentLink,
                        service: api.service,
                        status: api.status,
                        message: api.message,
                    },
                    channel: {
                        name: api.userInfo?.name,
                        user: api.userInfo?.username,
                        id: api.userInfo?.userId,
                        avatar: api.userInfo?.userAvatar,
                        verified: api.userInfo?.isVerified || false,
                        site: api.userInfo?.externalUrl,
                        bio: api.userInfo?.userBio,
                        category: api.userInfo?.userCategory,
                        internal: api.userInfo?.internalUrl,
                        country: api.userInfo?.accountCountry,
                        joined: api.userInfo?.dateJoined,
                    },
                    stats: {
                        views: api.mediaStats?.viewsCount,
                        vids: api.mediaStats?.mediaCount,
                        subs: api.mediaStats?.followersCount,
                        following: api.mediaStats?.followingCount,
                        likes: api.mediaStats?.likesCount,
                        comments: api.mediaStats?.commentsCount,
                        favorites: api.mediaStats?.favouritesCount,
                        shares: api.mediaStats?.sharesCount,
                        downloads: api.mediaStats?.downloadsCount,
                    },
                    videos: videos.filter((v) => v.url),
                    audios: audios.filter((a) => a.url),
                });
            }).catch(reject);
        });
    }
}
