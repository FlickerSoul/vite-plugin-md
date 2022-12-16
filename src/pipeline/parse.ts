import type { GenericBuilder } from '../types/core'
import { transformer } from '../utils'

/**
 * Using the MarkdownIt parser we are able to extract raw HTML content
 */
export const parseHtml = <B extends readonly GenericBuilder[]>() => transformer<B>()('parser', (payload) => {
  try {
    const html = payload.parser.render(payload.md, {})

    return {
      ...payload,
      html,
      stage: 'parsed',
    }
  }
  catch (err) {
    console.error(`Parsing with Graymatter package failed. The markdown passed in was:\n${payload.md}\n\n`)
    throw err
  }
})
