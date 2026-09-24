import { createSupabaseBrowserClient } from '@/lib/supabase/client';
export async function optimizePhoto(file: File) {
    if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 10 * 1024 * 1024
    )
        throw Error('Оберіть JPG, PNG або WebP до 10 МБ.');
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        if (image.naturalWidth * image.naturalHeight > 60_000_000)
            throw Error('Фото завелике. Максимум 60 мегапікселів.');
        const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw Error('Не вдалося обробити фото.');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
                (b) => (b ? resolve(b) : reject(Error('Не вдалося обробити фото.'))),
                'image/webp',
                0.9,
            ),
        );
        if (blob.size > 5 * 1024 * 1024) throw Error('Спробуйте менше фото.');
        return blob;
    } finally {
        URL.revokeObjectURL(url);
    }
}
export async function uploadPhotos(bucket: 'reports' | 'portfolio', prefix: string, files: File[]) {
    const c = createSupabaseBrowserClient();
    if (!c) throw Error('Немає з’єднання.');
    const paths: string[] = [];
    try {
        for (const file of files) {
            const blob = await optimizePhoto(file),
                path = `${prefix}/${crypto.randomUUID()}.${blob.type === 'image/webp' ? 'webp' : 'png'}`;
            const r = await c.storage
                .from(bucket)
                .upload(path, blob, { contentType: blob.type, upsert: false });
            if (r.error) throw r.error;
            paths.push(path);
        }
        return paths;
    } catch (e) {
        if (paths.length) await c.storage.from(bucket).remove(paths);
        throw e;
    }
}
