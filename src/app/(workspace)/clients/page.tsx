import { workspaceContext } from '@/lib/workspace-server';
import { ClientsManager } from '@/components/clients-manager';
export default async function Clients() {
    const c = await workspaceContext(true);
    const [contacts, projects, account] = await Promise.all([
        c.supabase.from('clients').select('*').order('name'),
        c.supabase.from('projects').select('id,name,client_id,slug'),
        c.supabase
            .from('accounts')
            .select('portfolio_token,portfolio_public')
            .eq('user_id', c.user.id)
            .single(),
    ]);
    if (contacts.error || projects.error || account.error)
        throw Error('Не вдалося завантажити контакти.');
    return (
        <>
            <ClientsManager
                initial={contacts.data}
                projects={projects.data.map((p) => ({ ...p, owner_username: c.username }))}
                userId={c.user.id}
                portfolioToken={
                    account.data.portfolio_public ? account.data.portfolio_token : undefined
                }
            />
        </>
    );
}
