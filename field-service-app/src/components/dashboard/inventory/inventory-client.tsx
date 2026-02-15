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
import { Card, CardContent } from '@/components/ui/card';
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
    Loader2,
    Edit,
    Trash2,
    ChevronRight,
    SearchX
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
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Inventory</h1>
                    <p className="text-slate-400 mt-1">Manage parts and stock levels</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/20">
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
                                    <Label className="text-white">Name</Label>
                                    <Input name="name" required className="bg-slate-900 border-slate-700 text-white" placeholder="e.g. Copper Pipe" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white">SKU</Label>
                                    <Input name="sku" required className="bg-slate-900 border-slate-700 text-white" placeholder="e.g. CP-001" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-white">Description</Label>
                                <Input name="description" className="bg-slate-900 border-slate-700 text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-white">Cost Price ($)</Label>
                                    <Input name="cost_price" type="number" step="0.01" required className="bg-slate-900 border-slate-700 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white">Retail Price ($)</Label>
                                    <Input name="retail_price" type="number" step="0.01" required className="bg-slate-900 border-slate-700 text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-white">Initial Stock</Label>
                                    <Input name="stock_quantity" type="number" required className="bg-slate-900 border-slate-700 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white">Min Stock Level</Label>
                                    <Input name="min_stock_level" type="number" defaultValue="5" className="bg-slate-900 border-slate-700 text-white" />
                                </div>
                            </div>
                            <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Create Item
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Total Items Count - Matching Job Page Pattern */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 inline-block">
                <p className="text-sm text-slate-400">Total Items</p>
                <p className="text-2xl font-bold text-white">{items.length}</p>
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
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold text-white">Current Inventory</h2>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search..."
                            className="pl-9 h-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-slate-600"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {filteredItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        {search ? (
                            <>
                                <p>No items found matching "{search}"</p>
                                <Button variant="link" onClick={() => setSearch('')} className="mt-2 text-blue-400">
                                    Clear search
                                </Button>
                            </>
                        ) : (
                            <p>No inventory items yet.</p>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop View */}
                        <div className="hidden md:block overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-slate-700 hover:bg-transparent">
                                        <TableHead className="text-slate-400">Name</TableHead>
                                        <TableHead className="text-slate-400">SKU</TableHead>
                                        <TableHead className="text-slate-400">Stock</TableHead>
                                        <TableHead className="text-slate-400">Price</TableHead>
                                        <TableHead className="text-slate-400">Status</TableHead>
                                        <TableHead className="text-slate-400 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map((item) => (
                                        <TableRow key={item.id} className="border-slate-700 hover:bg-slate-700/30">
                                            <TableCell>
                                                <div className="font-medium text-white flex items-center gap-2">
                                                    <div className="p-2 rounded-lg bg-slate-700/50">
                                                        <Package className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                    <div>{item.name}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-slate-400 font-mono text-xs">{item.sku}</TableCell>
                                            <TableCell className={item.stock_quantity <= item.min_stock_level ? 'text-amber-400 font-medium' : 'text-slate-300'}>
                                                {item.stock_quantity}
                                            </TableCell>
                                            <TableCell className="text-slate-300">${item.retail_price.toFixed(2)}</TableCell>
                                            <TableCell>
                                                {item.stock_quantity <= item.min_stock_level ? (
                                                    <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                                        Low Stock
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                                                        In Stock
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-slate-400 hover:text-white hover:bg-slate-700"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden p-4 space-y-4 bg-slate-900/50">
                            {filteredItems.map((item) => (
                                <Card key={item.id} className="bg-slate-800 border-slate-700 overflow-hidden">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-white">{item.name}</h3>
                                                <p className="text-sm text-slate-400">{item.sku}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-white"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mb-4">
                                            <Badge variant="outline" className={
                                                item.stock_quantity <= item.min_stock_level
                                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                    : 'bg-green-500/20 text-green-400 border-green-500/30'
                                            }>
                                                {item.stock_quantity <= item.min_stock_level ? 'Low Stock' : 'In Stock'}
                                            </Badge>
                                            <span className="text-white font-medium">${item.retail_price.toFixed(2)}</span>
                                        </div>

                                        <div className="flex items-center justify-between text-sm py-2 border-t border-slate-700">
                                            <span className="text-slate-400">Available Quantity</span>
                                            <span className={`font-mono ${item.stock_quantity <= item.min_stock_level ? 'text-amber-400 font-bold' : 'text-white'}`}>
                                                {item.stock_quantity}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
