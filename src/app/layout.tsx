import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
    variable: '--font-inter',
    subsets: ['latin', 'cyrillic'],
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Мій кошторис | Кабінет майстра',
    description: 'Кошториси, проекти та портфоліо майстра в одному кабінеті.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
    return (
        <html
            lang="uk"
            className={`${inter.variable} h-full antialiased`}
        >
            <body className="min-h-full flex flex-col">{children}</body>
        </html>
    );
}
