'use client';
import { useState } from 'react';
export function ShareLink({
    url,
    title,
    phone = '',
}: {
    url: string;
    title: string;
    phone?: string;
}) {
    const [notice, setNotice] = useState('');
    const text = `${title}\n${url}`;
    async function copy() {
        try {
            await navigator.clipboard.writeText(url);
            setNotice('Посилання скопійовано.');
        } catch {
            setNotice('Виділіть посилання в полі та скопіюйте.');
        }
    }
    async function share() {
        try {
            if (navigator.share) await navigator.share({ title, url });
            else await copy();
        } catch {
            setNotice('Надсилання скасовано.');
        }
    }
    return (
        <div className="mt-3 grid gap-2">
            <input
                className="min-w-0 rounded-lg border border-line p-3 text-xs"
                aria-label="Посилання для надсилання"
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
            />
            <div className="flex flex-wrap gap-3 text-xs text-brand">
                <button onClick={() => void copy()} type="button">
                    Копіювати
                </button>
                <button onClick={() => void share()} type="button">
                    Поділитися
                </button>
                <a
                    target="_blank"
                    rel="noreferrer"
                    href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
                >
                    Telegram
                </a>
                <a href={`viber://forward?text=${encodeURIComponent(text)}`}>Viber</a>
                <a href={`sms:${phone.replace(/[^+\d]/g, '')}?body=${encodeURIComponent(text)}`}>
                    SMS
                </a>
            </div>
            {notice && (
                <p role="status" className="text-xs text-subtle">
                    {notice}
                </p>
            )}
        </div>
    );
}
