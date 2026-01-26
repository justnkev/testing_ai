import { getInventoryItems } from '@/lib/actions/inventory';
import { InventoryClient } from '@/components/dashboard/inventory/inventory-client';

export default async function InventoryPage() {
    const result = await getInventoryItems();
    const items = result.success ? result.data : [];

    return <InventoryClient initialItems={items || []} />;
}
