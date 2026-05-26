import type { NextApiRequest, NextApiResponse } from 'next'

const STORE_HINTS: Record<string, string> = {
  'pxgo.com.tw': '全聯',
  'pxmart.com.tw': '全聯',
  'carrefour.com.tw': '家樂福',
  'momoshop.com.tw': 'momo',
  'momo.com.tw': 'momo',
  'shopee.tw': '蝦皮',
}

function detectStore(url: string): string {
  for (const [domain, name] of Object.entries(STORE_HINTS)) {
    if (url.includes(domain)) return name
  }
  return '其他'
}

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

  const store = detectStore(url)

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
    const rawName = extractTitle(html)
    const name = rawName
      .replace(/^\s*(全聯|家樂福|momo購物|蝦皮購物)\s*[|-]\s*/i, '')
      .replace(/\s*[|-]\s*(全聯|家樂福|momo購物|蝦皮購物)\s*$/i, '')
      .slice(0, 60)
    const image_url = extractMeta(html, 'og:image') || null
    const price = extractPrice(html)
    return res.status(200).json({ name: name || '請手動填寫商品名稱', image_url, price, store, url })
  } catch (e: any) {
    // 抓取失敗時仍回傳賣場資訊，讓使用者手動補填
    return res.status(200).json({ name: '', image_url: null, price: null, store, url })
  }
}
