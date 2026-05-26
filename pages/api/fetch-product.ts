import type { NextApiRequest, NextApiResponse } from 'next'

function extractMeta(html: string, property: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

function extractTitle(html: string): string {
  const og = extractMeta(html, 'og:title')
  if (og) return og
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m?.[1]?.trim() || ''
}

function extractPrice(html: string): number | null {
  const og = extractMeta(html, 'product:price:amount') || extractMeta(html, 'og:price:amount')
  if (og) return parseInt(og)
  const patterns = [/NT\$\s*([\d,]+)/, /\$\s*([\d,]+)/, /"price":\s*"?([\d.]+)"?/]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) return parseInt(m[1].replace(/,/g, ''))
  }
  return null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { url } = req.body as { url: string }
  if (!url || !url.startsWith('http')) return res.status(400).json({ error: '請提供有效的商品網址' })
  if (!url.includes('pxgo.com.tw') && !url.includes('pxmart.com.tw')) {
    return res.status(400).json({ error: '目前僅支援全聯商品網址（pxgo.com.tw）' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9',
      },
    })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const html = await response.text()
    const name = extractTitle(html)
      .replace(/^\s*全聯\s*[|-]\s*/i, '')
      .replace(/\s*[|-]\s*全聯\s*$/i, '')
      .replace(/\s*-\s*全聯小時達\s*$/i, '')
      .slice(0, 60)
    const image_url = extractMeta(html, 'og:image') || null
    const price = extractPrice(html)
    return res.status(200).json({ name: name || '請手動填寫商品名稱', image_url, price, store: '全聯', url })
  } catch (e: any) {
    if (e.name === 'AbortError') return res.status(408).json({ error: '連線逾時，請稍後再試' })
    return res.status(500).json({ error: '無法取得商品資料，請手動填寫' })
  }
}
