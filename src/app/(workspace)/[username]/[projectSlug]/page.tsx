import { notFound } from 'next/navigation';
import { workspaceContext } from '@/lib/workspace-server';
import { renderProject } from '@/lib/project-page';
export default async function Project({
    params,
}: {
    params: Promise<{ username: string; projectSlug: string }>;
}) {
    const { username, projectSlug } = await params;
    const c = await workspaceContext();
    const r = await c.supabase.rpc('resolve_project', {
        p_username: username,
        p_slug: projectSlug,
    });
    if (r.error) throw Error('Не вдалося відкрити проєкт.');
    if (!r.data) notFound();
    return renderProject(c, r.data);
}
