import { notFound } from 'next/navigation';
import { workspaceContext } from '@/lib/workspace-server';
import { ProjectWorkspace, type WorkflowDetail } from '@/components/project-workspace';
export async function renderProject(c: Awaited<ReturnType<typeof workspaceContext>>, id: string) {
    const { data, error } = await c.supabase.rpc('workflow_detail', { p_project_id: id });
    if (error?.code === '42501' || (!data && !error)) notFound();
    if (error) throw Error('Не вдалося завантажити проєкт.');
    const d = data as WorkflowDetail;
    const contacts = d.is_owner
        ? await c.supabase.from('clients').select('*').order('name')
        : { data: [] };
    if ('error' in contacts && contacts.error) throw Error('Не вдалося завантажити контакти.');
    return (
        <>
            <ProjectWorkspace initial={d} userId={c.user.id} contacts={contacts.data ?? []} />
        </>
    );
}
