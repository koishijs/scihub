import { Context, Schema, h } from 'koishi'
import SciHub from './scihub'

export const name = 'scihub'

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  // write your plugin here
  const sh = new SciHub(ctx)
  const cmd = ctx.command('scihub <text...>', '获取论文下载直链')
    .option('limit', '-l <limit:number> 限制搜索结果数量(未实现)')
    .option('download', '-d 下载搜索结果（发不出）')
    .action(async ({ session, options }, text) => {

      if (!text?.trim()) return session.execute(`help ${name}`)

      session.send(h.text('正在搜索...'))
      // const searchResults = await sh.search(text, options.limit)
      const searchResults = await sh.search(text)

      if (options.download) {
        searchResults.papers.map(async paper => {
          const res = await sh.download(paper.url)
          if (!res.err) await session.send(h.file(res.pdf, 'application/pdf'))
          else session.send(res.err)
        })
      }
      else {
        const result = h('figure')
        await Promise.all(searchResults.papers.map(async paper => {
          let url = await sh.getDirectUrl(paper.url)
          result.children.push(h('message', paper.name + '\n' + (url ||= paper.url)))
          await new Promise(resolve => setTimeout(resolve, 1000)) //sleep 1s
        }))
        session.send(result)
      }
    })
}
