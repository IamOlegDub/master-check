import { workspaceContext } from '@/lib/workspace-server';
import { WorkspaceShell } from '@/components/workspace-shell';
import { WorkspaceHome } from '@/components/workspace-home';
export default async function Projects() {
    const c = await workspaceContext();
    const { data, error } = await c.supabase.rpc('workspace_projects');
    if (error) throw Error('Не вдалося завантажити проєкти.');
    const contacts =
        c.role === 'MASTER'
            ? await c.supabase.from('clients').select('*').order('name')
            : { data: [] };
    if ('error' in contacts && contacts.error) throw Error('Не вдалося завантажити клієнтів.');
    return (
        <WorkspaceShell role={c.role} name={c.name} avatar={c.profile.avatarUrl} title="Проєкти">
            <WorkspaceHome
                projects={data ?? []}
                contacts={contacts.data ?? []}
                role={c.role}
                username={c.username}
                userId={c.user.id}
            />
        </WorkspaceShell>
    );
}
