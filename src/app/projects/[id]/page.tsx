import { notFound, redirect } from 'next/navigation';
import { workspaceContext } from '@/lib/workspace-server';
import { validId } from '@/lib/workspace';
import { projectHref } from '@/lib/project-url';
import { renderProject } from '@/lib/project-page';
export default async function LegacyProject({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!validId(id)) notFound();
    const c = await workspaceContext();
    const r = await c.supabase.rpc('workflow_detail', { p_project_id: id });
    if (r.error?.code === '42501' || (!r.data && !r.error)) notFound();
    if (r.error) throw Error('Не вдалося відкрити проєкт.');
    const path = projectHref(r.data.project);
    if (path !== `/projects/${id}`) redirect(path);
    return renderProject(c, id);
}
