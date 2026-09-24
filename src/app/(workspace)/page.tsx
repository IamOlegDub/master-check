import { redirect } from 'next/navigation';
import { workspaceContext } from '@/lib/workspace-server';
import { WorkspaceHome } from '@/components/workspace-home';
export default async function Home({
    searchParams,
}: {
    searchParams: Promise<{ section?: string }>;
}) {
    const { section } = await searchParams;
    const paths: Record<string, string> = {
        projects: '/projects',
        services: '/services',
        portfolio: '/portfolio',
        clients: '/clients',
    };
    if (section && paths[section]) redirect(paths[section]);
    const c = await workspaceContext();
    const { data: projects, error } = await c.supabase.rpc('workspace_projects');
    if (error) throw Error('Не вдалося завантажити проєкти. Перевірте міграції та з’єднання.');
    const contacts =
        c.role === 'MASTER'
            ? await c.supabase.from('clients').select('*').order('name')
            : { data: [] };
    if ('error' in contacts && contacts.error) throw Error('Не вдалося завантажити клієнтів.');
    return (
        <>
            <WorkspaceHome
                projects={projects ?? []}
                contacts={contacts.data ?? []}
                role={c.role}
                username={c.username}
                userId={c.user.id}
                overview
            />
        </>
    );
}
