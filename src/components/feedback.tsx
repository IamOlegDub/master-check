'use client';
import { LoaderCircle } from 'lucide-react';
export function BusyIndicator({
    busy,
    label = 'Зберігаємо зміни…',
}: {
    busy: boolean;
    label?: string;
}) {
    if (!busy) return null;
    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed top-3 left-1/2 z-[250] flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-white px-5 py-3 text-sm text-ink shadow-lg"
        >
            <LoaderCircle
                size={19}
                className="shrink-0 animate-spin motion-reduce:animate-none text-brand"
            />
            {label}
        </div>
    );
}
export function WorkspaceSkeleton() {
    return (
        <section aria-busy="true" aria-label="Завантаження сторінки" className="w-full py-4">
            <span role="status" className="sr-only">
                Завантажуємо робочий простір…
            </span>
            <div className="mx-auto grid max-w-6xl gap-6 motion-safe:animate-pulse">
                <div className="h-12 w-2/3 rounded-xl bg-[#e8e9f2]" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-28 rounded-2xl border border-line bg-white" />
                    ))}
                </div>
                <div className="h-12 rounded-xl bg-[#e8e9f2]" />
                <div className="grid gap-4 sm:grid-cols-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-52 rounded-2xl border border-line bg-white p-6">
                            <div className="h-5 w-2/3 rounded bg-[#ededf5]" />
                            <div className="mt-5 h-3 rounded bg-[#ededf5]" />
                            <div className="mt-3 h-3 w-3/4 rounded bg-[#ededf5]" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
