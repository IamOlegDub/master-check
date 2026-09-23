import { workspaceContext } from '@/lib/workspace-server';
import { WorkspaceShell } from '@/components/workspace-shell';
import { PortfolioManager } from '@/components/portfolio-manager';
export default async function Portfolio() {
    const c = await workspaceContext(true);
    const [albums, photos, categories, account] = await Promise.all([
        c.supabase.from('portfolio_albums').select('*').order('created_at', { ascending: false }),
        c.supabase.from('portfolio_photos').select('*').order('created_at'),
        c.supabase.from('service_categories').select('id,name').order('name'),
        c.supabase
            .from('accounts')
            .select('portfolio_token,portfolio_public')
            .eq('user_id', c.user.id)
            .single(),
    ]);
    if (albums.error || photos.error || categories.error || account.error)
        throw Error('Не вдалося відкрити портфоліо.');
    return (
        <WorkspaceShell role={c.role} name={c.name} avatar={c.profile.avatarUrl} title="Портфоліо">
            <PortfolioManager
                initial={albums.data}
                initialPhotos={photos.data}
                categories={categories.data}
                userId={c.user.id}
                publicToken={account.data.portfolio_token}
                isPublic={account.data.portfolio_public}
            />
        </WorkspaceShell>
    );
}
