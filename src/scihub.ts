import { Context } from 'koishi'
import { load } from 'cheerio'

const SCHOLARS_BASE_URL = 'https://scholar.google.com/scholar'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36' }

export class SciHub {
    http: Context
    base_url: string
    ctx: Context
    constructor(ctx: Context) {
        this.ctx = ctx
        this.init()
    }

    async init() {
        const res = await this.ctx.http.get('https://sci-hub.now.sh/', { headers: HEADERS })
        this.base_url = load(res)('a[href*="sci-hub."]').first().attr('href') + '/'
    }

    async search(query: string, limit = 10) {
        const results = { papers: [] }

        for (let start = 0; results.papers.length < limit; start += 10) {
            try {
                const res = await this.ctx.http.get(SCHOLARS_BASE_URL, {
                    params: { q: query }, // 加上 start 会 429，待查
                    headers: HEADERS,
                })
                const $ = load(res)
                const papers = $('div.gs_r').filter((_, paper) => !$(paper).find('table').length)

                if (!papers.length) {
                    if (res.includes('CAPTCHA')) {
                        throw new Error(`Failed to complete search with query ${query} (captcha)`) //TODO: 2captcha
                    } 
                    break
                }

                papers.each((_, paper) => {
                    const $paper = $(paper)
                    const name = $paper.find('h3.gs_rt').text()
                    const url =
                        $paper.find('div.gs_ggs.gs_fl a').attr('href') || $paper.find('h3.gs_rt a').attr('href')

                    if (url && results.papers.length < limit) {
                        results.papers.push({ name, url })
                    }
                })
            } catch (error) {
                results[0] = `Failed to complete search with query ${query} due to request exception.\n${error}`
                return results
            }
        }
        return results
    }

    async download(identifier: string) {
        try {
            const url = await this.getDirectUrl(identifier)
            const res: ArrayBuffer = await this.ctx.http.get(url, { responseType: 'arraybuffer', headers: HEADERS })
            return { pdf: res, url }
        } catch (error) {
            await this.init()
            return { err: `Failed to fetch pdf with identifier ${identifier} due to request exception.\n${error}` }
        }
    }

    async getDirectUrl(identifier: string) {
        return identifier.endsWith('pdf') ? identifier : await this._searchDirectUrl(identifier)
    }

    async _searchDirectUrl(identifier: string) {
        const res = await this.ctx.http.get(this.base_url + identifier, { headers: HEADERS })
        const src = load(res)('iframe').attr('src')
        return src?.startsWith('//') ? `http:${src}` : src

    }
}

export default SciHub
