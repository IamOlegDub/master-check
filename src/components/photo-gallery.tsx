'use client';
import { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
export type GalleryPhoto = { path: string; caption?: string };
export function PhotoGallery({
    bucket,
    photos,
}: {
    bucket: 'reports' | 'portfolio';
    photos: GalleryPhoto[];
}) {
    const [urls, setUrls] = useState<Record<string, string>>({}),
        [error, setError] = useState(''),
        [active, setActive] = useState<number | null>(null),
        [list, setList] = useState(false),
        [retry, setRetry] = useState(0);
    const signature = photos.map((p) => p.path).join('|');
    useEffect(() => {
        let live = true;
        const c = createSupabaseBrowserClient();
        if (!signature) return;
        void c?.storage
            .from(bucket)
            .createSignedUrls(signature.split('|'), 300)
            .then((r) => {
                if (!live) return;
                if (r.error || r.data?.some((p) => p.error)) {
                    setError('Не вдалося відкрити фото. Оновіть галерею.');
                    return;
                }
                setError('');
                setUrls(
                    Object.fromEntries(
                        (r.data ?? [])
                            .filter((p) => p.path && p.signedUrl)
                            .map((p) => [p.path!, p.signedUrl!]),
                    ),
                );
            });
        return () => {
            live = false;
        };
    }, [signature, bucket, retry]);
    if (!photos.length) return null;
    return (
        <div className="mt-4">
            <div className="mb-3 flex gap-4 text-xs text-brand">
                <button onClick={() => setList(!list)}>
                    {list ? 'Показати сіткою' : 'Показати списком'}
                </button>
                <button onClick={() => setRetry((x) => x + 1)}>Оновити фото</button>
            </div>
            {error && (
                <p role="alert" className="text-red-700">
                    {error}
                </p>
            )}
            <div className={list ? 'grid gap-4' : 'grid grid-cols-2 gap-3 sm:grid-cols-3'}>
                {photos.map((photo, index) => (
                    <button
                        type="button"
                        key={photo.path}
                        onClick={() => setActive(index)}
                        className="overflow-hidden rounded-xl border border-line bg-white text-left"
                        aria-label={`Відкрити фото ${index + 1}`}
                    >
                        <img
                            src={urls[photo.path] || undefined}
                            alt={photo.caption || `Фото роботи ${index + 1}`}
                            loading="lazy"
                            className={
                                list
                                    ? 'max-h-[65svh] w-full object-contain'
                                    : 'aspect-square w-full object-cover'
                            }
                        />
                        {photo.caption && (
                            <span className="block p-3 text-xs wrap-anywhere">{photo.caption}</span>
                        )}
                    </button>
                ))}
            </div>
            <Dialog.Root
                open={active !== null}
                onOpenChange={(open) => {
                    if (!open) setActive(null);
                }}
            >
                <Dialog.Portal>
                    <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/85" />
                    <Dialog.Popup
                        className="fixed inset-3 z-[51] flex flex-col justify-center rounded-xl bg-black p-3 text-white"
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowRight')
                                setActive((x) => ((x ?? 0) + 1) % photos.length);
                            if (e.key === 'ArrowLeft')
                                setActive((x) => ((x ?? 0) - 1 + photos.length) % photos.length);
                        }}
                    >
                        <Dialog.Title className="sr-only">Перегляд фотографій</Dialog.Title>
                        <Dialog.Close className="absolute top-2 right-2 rounded-lg bg-white px-4 py-3 text-black">
                            Закрити
                        </Dialog.Close>
                        {active !== null && (
                            <img
                                className="max-h-[78svh] w-full object-contain"
                                alt={photos[active]?.caption || 'Фото виконаних робіт'}
                                src={urls[photos[active]?.path] || undefined}
                            />
                        )}
                        <div className="mt-3 flex items-center justify-between">
                            <button
                                className="p-3"
                                onClick={() =>
                                    setActive((x) => ((x ?? 0) - 1 + photos.length) % photos.length)
                                }
                            >
                                ← Попереднє
                            </button>
                            <span>
                                {(active ?? 0) + 1} / {photos.length}
                            </span>
                            <button
                                className="p-3"
                                onClick={() => setActive((x) => ((x ?? 0) + 1) % photos.length)}
                            >
                                Наступне →
                            </button>
                        </div>
                    </Dialog.Popup>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
