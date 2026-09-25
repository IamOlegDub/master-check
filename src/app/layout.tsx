import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PwaRegistration } from '@/components/pwa';
import { ThemeProvider } from '@/components/theme-provider';
import { themeScript } from '@/lib/theme';

const inter = Inter({
    variable: '--font-inter',
    subsets: ['latin', 'cyrillic'],
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Мій кошторис | Кабінет майстра',
    description: 'Кошториси, проекти та портфоліо майстра в одному кабінеті.',
    appleWebApp: { capable: true, title: 'Master Check', statusBarStyle: 'default' },
    icons: {
        icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
        apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#ffffff',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
    return (
        <html lang="uk" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body className="min-h-full flex flex-col">
                <ThemeProvider>
                    <PwaRegistration />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
