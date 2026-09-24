'use client';
import { ErrorScreen } from '@/components/error-screen';
import './globals.css';
export default function GlobalError({ reset }: { reset: () => void }) {
    return (
        <html lang="uk">
            <body>
                <ErrorScreen reset={reset} />
            </body>
        </html>
    );
}
