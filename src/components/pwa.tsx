'use client';
import { useEffect, useState } from 'react';
type InstallPrompt = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
};
export function PwaRegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
            void navigator.serviceWorker
                .register('/sw.js', { scope: '/', updateViaCache: 'none' })
                .catch(() => {});
    }, []);
    return null;
}
export function InstallApp() {
    const [prompt, setPrompt] = useState<InstallPrompt | null>(null),
        [installed, setInstalled] = useState(false);
    useEffect(() => {
        setInstalled(matchMedia('(display-mode: standalone)').matches);
        const capture = (e: Event) => {
            e.preventDefault();
            setPrompt(e as InstallPrompt);
        };
        const done = () => {
            setInstalled(true);
            setPrompt(null);
        };
        window.addEventListener('beforeinstallprompt', capture);
        window.addEventListener('appinstalled', done);
        return () => {
            window.removeEventListener('beforeinstallprompt', capture);
            window.removeEventListener('appinstalled', done);
        };
    }, []);
    if (installed) return null;
    return (
        <section className="mt-6 rounded-2xl border border-line bg-card p-5">
            <h2 className="font-semibold">Застосунок на головному екрані</h2>
            {prompt ? (
                <button
                    className="mt-3 rounded-xl bg-[var(--brand-solid)] p-3 text-white"
                    onClick={async () => {
                        await prompt.prompt();
                        await prompt.userChoice;
                        setPrompt(null);
                    }}
                >
                    Встановити застосунок
                </button>
            ) : (
                <p className="mt-3 text-sm text-subtle">
                    На iPhone: Safari → Поділитися → На початковий екран. На Android або комп’ютері:
                    меню браузера → Встановити застосунок / Додати на головний екран.
                </p>
            )}
            <p className="mt-2 text-xs text-subtle">
                Для роботи з даними потрібне з’єднання з інтернетом.
            </p>
        </section>
    );
}
