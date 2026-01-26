'use client';

import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Search,
    Plus,
    AlertTriangle,
    Package,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { createInventoryItem } from '@/lib/actions/inventory';
import type { InventoryItem } from '@/lib/validations/inventory';

interface InventoryClientProps {
    initialItems: InventoryItem[];
}

export function InventoryClient({ initialItems }: InventoryClientProps) {
    const [items, setItems] = useState<InventoryItem[]>(initialItems);
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter items
    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase())
    );

    // Filter low stock
    const lowStockItems = items.filter(item => item.stock_quantity <= item.min_stock_level);

    async function handleAddItem(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        // Convert FormData to object manually to handle coercion if needed, 
        // but our Zod schema expects raw values or coercible strings.
        // We'll pass the plain object from Object.fromEntries to be cleaner
        const data = Object.fromEntries(formData.entries());

        const result = await createInventoryItem(data);

        setIsSubmitting(false);

        if (result.success) {
            toast.success('Item added successfully');
            if (result.data) {
                setItems(prev => [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name)));
            }
            setIsDialogOpen(false);
        } else {
            toast.error(result.error);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Inventory</h1>
                    <p className="text-slate-400">Manage parts and stock levels</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Item
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-slate-700 text-white">
                        <DialogHeader>
                            <DialogTitle>Add Inventory Item</DialogTitle>
                            <DialogDescription className="text-slate-400">
                                Add a new part to your inventory tracking.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddItem} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input name="name" required className="bg-slate-700" placeholder="e.g. Copper Pipe" />
                                </div>
                                <div className="space-y-2">
                                    <Label>SKU</Label>
                                    <Input name="sku" required className="bg-slate-700" placeholder="e.g. CP-001" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input name="description" className="bg-slate-700" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Cost Price ($)</Label>
                                    <Input name="cost_price" type="number" step="0.01" required className="bg-slate-700" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Retail Price ($)</Label>
                                    <Input name="retail_price" type="number" step="0.01" required className="bg-slate-700" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Initial Stock</Label>
                                    <Input name="stock_quantity" type="number" required className="bg-slate-700" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Min Stock Level</Label>
                                    <Input name="min_stock_level" type="number" defaultValue="5" className="bg-slate-700" />
                                </div>
                            </div>
                            <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600">
                                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Create Item
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Low Stock Alert */}
            {lowStockItems.length > 0 && (
                <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Low Stock Alert</AlertTitle>
                    <AlertDescription>
                        {lowStockItems.length} items are below minimum stock levels.
                    </AlertDescription>
                </Alert>
            )}

            {/* Main Content */}
            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                        <span>Items</span>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search inventory..."
                                className="pl-8 bg-slate-900 border-slate-700 text-white"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-700 hover:bg-slate-700/50">
                                <TableHead className="text-slate-400">Name</TableHead>
                                <TableHead className="text-slate-400">SKU</TableHead>
                                <TableHead className="text-slate-400">Stock</TableHead>
                                <TableHead className="text-slate-400">Price</TableHead>
                                <TableHead className="text-slate-400">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        No items found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item) => (
                                    <TableRow key={item.id} className="border-slate-700 hover:bg-slate-700/50">
                                        <TableCell className="font-medium text-white">
                                            <div className="flex items-center gap-2">
                                                <Package className="w-4 h-4 text-slate-500" />
                                                {item.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-300 font-mono text-xs">{item.sku}</TableCell>
                                        <TableCell className={item.stock_quantity <= item.min_stock_level ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                                            {item.stock_quantity}
                                        </TableCell>
                                        <TableCell className="text-slate-300">${item.retail_price.toFixed(2)}</TableCell>
                                        <TableCell>
                                            {item.stock_quantity <= item.min_stock_level ? (
                                                <Badge variant="outline" className="border-amber-500/20 text-amber-400 bg-amber-500/10">
                                                    Low Stock
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-green-500/20 text-green-400 bg-green-500/10">
                                                    In Stock
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
