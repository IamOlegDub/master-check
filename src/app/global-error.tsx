'use client';
import { ErrorScreen } from '@/components/error-screen';
import './globals.css';
export default function GlobalError({ retry }: { retry: () => void }) {
    return (
        <html lang="uk">
            <body>
                <ErrorScreen retry={retry} />
            </body>
        </html>
    );
}
