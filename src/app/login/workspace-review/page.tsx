'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ProjectWorkspace } from '@/components/project-workspace';
import { WorkspaceHome } from '@/components/workspace-home';
import { PortfolioManager } from '@/components/portfolio-manager';
import { ClientsManager } from '@/components/clients-manager';
import { PriceList } from '@/components/price-list';
import type { WorkflowDetail } from '@/components/project-workspace';
import type { Role } from '@/lib/workspace';
import { WorkspaceShell } from '@/components/workspace-shell';
const uid = '11111111-1111-4111-8111-111111111111',
    pid = '22222222-2222-4222-8222-222222222222',
    sid = '33333333-3333-4333-8333-333333333333';
export default function Review() {
    const [data, setData] = useState<WorkflowDetail | null>(null),
        [screen, setScreen] = useState('project'),
        [role, setRole] = useState<Role>('MASTER');
    useEffect(() => {
        const q = new URLSearchParams(location.search);
        setScreen(q.get('screen') || 'project');
        setRole(q.get('role') === 'CLIENT' ? 'CLIENT' : 'MASTER');
        void createSupabaseBrowserClient()!
            .rpc('workflow_detail', { p_project_id: pid })
            .then((r) => setData(r.data));
    }, []);
    if (!data) return <p>Loading review</p>;
    return (
        <WorkspaceShell role={role} name="Іван Сидоренко">
            {screen === 'project' ? (
                <ProjectWorkspace initial={data} userId={uid} contacts={[]} />
            ) : screen === 'portfolio' ? (
                <PortfolioManager
                    initial={[]}
                    initialPhotos={[]}
                    categories={[{ id: sid, name: 'Плитка' }]}
                    userId={uid}
                    publicToken={sid}
                    isPublic={false}
                />
            ) : screen === 'clients' ? (
                <ClientsManager initial={[]} projects={[]} userId={uid} />
            ) : screen === 'services' ? (
                <>
                    <h1>Послуги та ціни</h1>
                    <PriceList userId={uid} userName="Іван Сидоренко" />
                </>
            ) : (
                <WorkspaceHome
                    projects={[
                        {
                            ...data.project,
                            confirmed_total: data.confirmed_total,
                            advance_total: 0,
                            pending_count: data.pending_count,
                            progress: 13,
                        },
                    ]}
                    contacts={[]}
                    userId={uid}
                    role={role}
                    overview
                />
            )}
        </WorkspaceShell>
    );
}
