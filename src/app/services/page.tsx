import { workspaceContext } from '@/lib/workspace-server';
import { WorkspaceShell } from '@/components/workspace-shell';
import { PriceList } from '@/components/price-list';
export default async function Services() {
    const c = await workspaceContext(true);
    return (
        <WorkspaceShell
            role={c.role}
            name={c.name}
            avatar={c.profile.avatarUrl}
            title="Послуги та ціни"
        >
            <h1 className="text-3xl font-semibold">Послуги та ціни</h1>
            <PriceList userId={c.user.id} userName={c.name} />
        </WorkspaceShell>
    );
}
