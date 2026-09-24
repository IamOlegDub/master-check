import { workspaceContext } from '@/lib/workspace-server';
import { SettingsWorkspace } from '@/components/settings-workspace';
export default async function Settings() {
    const c = await workspaceContext();
    return <SettingsWorkspace initial={c.profile} userId={c.user.id} username={c.username} />;
}
