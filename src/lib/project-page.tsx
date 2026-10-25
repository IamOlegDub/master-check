import { notFound } from 'next/navigation';
import { workspaceContext } from '@/lib/workspace-server';
import { ProjectWorkspace, type WorkflowDetail } from '@/components/project-workspace';
export async function renderProject(
    c: Awaited<ReturnType<typeof workspaceContext>>,
    id: string,
    loaded?: WorkflowDetail,
) {
    // Contacts are visible only to their master, so they can load alongside the project.
    const [detail, contacts] = await Promise.all([
        loaded
            ? { data: loaded, error: null }
            : c.supabase.rpc('workflow_detail', { p_project_id: id }),
        c.supabase.from('clients').select('*').order('name'),
    ]);
    if (detail.error?.code === '42501' || (!detail.data && !detail.error)) notFound();
    if (detail.error) throw Error('Не вдалося завантажити проєкт.');
    const d = detail.data as WorkflowDetail;
    if (d.is_owner && contacts.error) throw Error('Не вдалося завантажити контакти.');
    return (
        <ProjectWorkspace
            initial={d}
            userId={c.user.id}
            contacts={d.is_owner ? (contacts.data ?? []) : []}
        />
    );
}
