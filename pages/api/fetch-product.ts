import type { NextApiRequest, NextApiResponse } from 'next'

const STORE_MAP: Record<string, string> = {
  'pxgo.com.tw': '全聯',
  'pxmart.com.tw': '全聯',
  'carrefour.com.tw': '家樂福',
  'momoshop.com.tw': 'momo',
  'momo.com.tw': 'momo',
  'shopee.tw': '蝦皮',
  'pchome.com.tw': 'PChome',
  'pcstore.com.tw': 'PChome',
  'ettv.com.tw': '東森購物',
  'etmall.com.tw': '東森購物',
  'costco.com.tw': 'Costco',
  'rt-mart.com.tw': '大潤發',
  'wellcome.com.tw': '頂好',
  '7-11.com.tw': '7-ELEVEN',
  'ibon.com.tw': '7-ELEVEN',
  'family.com.tw': '全家',
  'hilife.com.tw': '萊爾富',
  'yahoo.com': 'Yahoo購物',
  'buy.yahoo.com': 'Yahoo購物',
  'books.com.tw': '博客來',
  'ruten.com.tw': '露天市集',
  'rakuten.com.tw': '樂天',
  'senao.com.tw': '神腦',
  'coupang.com': 'Coupang',
}

function detectStore(url: string): string {
  for (const [domain, name] of Object.entries(STORE_MAP)) {
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
    const storeNames = Object.values(STORE_MAP).join('|')
    const nameRe = new RegExp(`^\\s*(${storeNames})\\s*[|\\-–]\\s*`, 'i')
    const nameReEnd = new RegExp(`\\s*[|\\-–]\\s*(${storeNames})\\s*$`, 'i')
    const name = extractTitle(html)
      .replace(nameRe, '')
      .replace(nameReEnd, '')
      .slice(0, 60)
    const image_url = extractMeta(html, 'og:image') || null
    const price = extractPrice(html)
    return res.status(200).json({ name: name || '', image_url, price, store, url })
  } catch (e: any) {
    if (e.name === 'AbortError') return res.status(200).json({ name: '', image_url: null, price: null, store, url })
    return res.status(200).json({ name: '', image_url: null, price: null, store, url })
  }
}
