import { WorkspaceShell } from '@/components/workspace-shell';
import { workspaceContext } from '@/lib/workspace-server';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
    const c = await workspaceContext();
    return (
        <WorkspaceShell role={c.role} name={c.name} avatar={c.profile.avatarUrl}>
            {children}
        </WorkspaceShell>
    );
}
