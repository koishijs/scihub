import { Context, Schema } from 'koishi'
import { load } from 'cheerio'

export const name = 'scihub'

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {

  const SCHOLARS_BASE_URL = 'https://scholar.google.com/scholar'
  const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36' }

  function getDirectLink(directRes: string) {
    const $direct = load(directRes)
    const directLink = $direct('iframe').attr('src')
    return directLink?.startsWith('//') ? `http:${directLink}` : directLink
  }
  async function getSciHubDirectLink(query: string) {
    try {
      const searchRes = await ctx.http.get(SCHOLARS_BASE_URL, { params: { q: query }, headers: HEADERS })
      const $search = load(searchRes)
      const firstPaperUrl = $search('div.gs_r').filter((_, paper) => !$search(paper).find('table').length).first().find('div.gs_ggs.gs_fl a').attr('href') || $search('h3.gs_rt a').attr('href')
      if (firstPaperUrl) {
        const sciHubRes = await ctx.http.get('https://sci-hub.now.sh/', { headers: HEADERS })
        const $sciHub = load(sciHubRes)
        const sciHubBaseUrl = $sciHub('a[href*="sci-hub."]').first().attr('href') + '/'
        const directRes = await ctx.http.get(sciHubBaseUrl + firstPaperUrl, { headers: HEADERS })
        const directLink = getDirectLink(directRes) || getDirectLink(await ctx.http.get(sciHubBaseUrl + query, { headers: HEADERS })) // try again with query if failed
        return directLink
      } else {
        throw new Error(`Failed to find a download link for the first result of query ${query}`)
      }
    } catch (error) {
      throw new Error(`Failed to complete search with query ${query} due to request exception.\n${error}`)
    }
  }

  ctx.command('scihub <dio...>', '获取论文下载链接')
    .action(async ({ session }, query) => {
      if (!query) return session.execute('help scihub')
      const link = await getSciHubDirectLink(query)
      if (link) {
        return link
      } else {
        return '未找到下载链接'
      }
    })
}
