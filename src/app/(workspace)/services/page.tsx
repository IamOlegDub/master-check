import { workspaceContext } from '@/lib/workspace-server';
import { PriceList } from '@/components/price-list';
export default async function Services() {
    const c = await workspaceContext(true);
    return (
        <>
            <h1 className="text-3xl font-semibold">Послуги та ціни</h1>
            <PriceList userId={c.user.id} userName={c.name} />
        </>
    );
}
