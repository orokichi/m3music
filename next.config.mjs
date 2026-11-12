/** @type {import('next').NextConfig} */
export default {
  serverExternalPackages: ['youtubei.js'],
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'Permissions-Policy', value: 'autoplay=*, fullscreen=*, picture-in-picture=*, encrypted-media=*' }] }];
  },
};
