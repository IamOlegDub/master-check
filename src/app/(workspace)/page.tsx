import { redirect } from 'next/navigation';
import { workspaceContext, workspaceProjects } from '@/lib/workspace-server';
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
    const { projects, contacts } = await workspaceProjects(c);
    return (
        <WorkspaceHome
            projects={projects}
            contacts={contacts}
            role={c.role}
            username={c.username}
            userId={c.user.id}
            overview
        />
    );
}
