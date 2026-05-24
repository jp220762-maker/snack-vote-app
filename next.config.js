/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.pxmart.com.tw' },
      { protocol: 'https', hostname: '**.carrefour.com.tw' },
      { protocol: 'https', hostname: '**.momoshop.com.tw' },
      { protocol: 'https', hostname: '**.shopee.tw' },
      { protocol: 'https', hostname: '**.shoplineapp.com' },
      { protocol: 'https', hostname: '**' },
    ],
  },
}
module.exports = nextConfig
