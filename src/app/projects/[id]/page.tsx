import { notFound } from 'next/navigation';
import { workspaceContext } from '@/lib/workspace-server';
import { validId } from '@/lib/workspace';
import { WorkspaceShell } from '@/components/workspace-shell';
import { ProjectWorkspace, type WorkflowDetail } from '@/components/project-workspace';
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!validId(id)) notFound();
    const c = await workspaceContext();
    const { data, error } = await c.supabase.rpc('workflow_detail', { p_project_id: id });
    if (error?.code === '42501') notFound();
    if (error) throw Error('Не вдалося завантажити проєкт.');
    if (!data) notFound();
    const d = data as WorkflowDetail;
    const contacts = d.is_owner
        ? await c.supabase.from('clients').select('*').order('name')
        : { data: [] };
    if ('error' in contacts && contacts.error) throw Error('Не вдалося завантажити клієнтів.');
    return (
        <WorkspaceShell
            role={c.role}
            name={c.name}
            avatar={c.profile.avatarUrl}
            title={d.project.name}
        >
            <ProjectWorkspace initial={d} userId={c.user.id} contacts={contacts.data ?? []} />
        </WorkspaceShell>
    );
}
