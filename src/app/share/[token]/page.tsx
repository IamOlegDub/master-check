import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { validId, panelClass } from '@/lib/workspace';
import { PhotoGallery } from '@/components/photo-gallery';
import { OverviewVideo } from '@/components/overview-video';
import { BrandLogo } from '@/components/brand-logo';
export const dynamic = 'force-dynamic';
type PublicAlbum = {
    id: string;
    title: string;
    description: string;
    categories: string[];
    photos: { id: string; path: string; caption: string }[];
    overview_video_path?: string | null;
    overview_video_at?: string | null;
};
export default async function Shared({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    if (!validId(token)) notFound();
    const c = await createSupabaseServerClient();
    if (!c) throw Error('Немає з’єднання.');
    const { data, error } = await c.rpc('public_portfolio', { p_token: token });
    if (error) throw Error('Не вдалося відкрити портфоліо.');
    const albums = data as PublicAlbum[];
    if (!albums?.length) notFound();
    return (
        <main className="min-h-dvh bg-[var(--tone-bg-f7f8fb)] p-4 text-ink sm:p-8">
            <div className="mx-auto grid max-w-6xl gap-6">
                <header>
                    <p className="flex items-center gap-3 text-sm text-brand">
                        <BrandLogo decorative />
                        Мій кошторис · Портфоліо майстра
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold">Виконані роботи</h1>
                </header>
                {albums.map((a) => (
                    <article key={a.id} className={panelClass}>
                        <h2 className="text-2xl font-semibold">{a.title}</h2>
                        <p className="mt-2 text-xs text-brand">{a.categories.join(' · ')}</p>
                        <p className="mt-3 whitespace-pre-wrap wrap-anywhere text-subtle">
                            {a.description}
                        </p>
                        <PhotoGallery bucket="portfolio" photos={a.photos} />
                        <OverviewVideo path={a.overview_video_path} addedAt={a.overview_video_at} />
                    </article>
                ))}
            </div>
        </main>
    );
}
