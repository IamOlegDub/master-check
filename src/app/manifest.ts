import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
    return {
        id: '/',
        name: 'Мій кошторис — майстер і замовник',
        short_name: 'Мій кошторис',
        description: 'Проєкти, кошториси, звіти та оплати',
        lang: 'uk',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f7f8fb',
        theme_color: '#6155db',
        icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
                src: '/icons/maskable-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    };
}
