import { workspaceContext, workspaceProjects } from '@/lib/workspace-server';
import { WorkspaceHome } from '@/components/workspace-home';
export default async function Projects() {
    const c = await workspaceContext();
    const { projects, contacts } = await workspaceProjects(c);
    return (
        <WorkspaceHome
            projects={projects}
            contacts={contacts}
            role={c.role}
            username={c.username}
            userId={c.user.id}
        />
    );
}
