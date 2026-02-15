'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Save, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

import type { InventoryItem } from '@/lib/validations/inventory';
import { upsertEstimate } from '@/lib/actions/estimates';
import type { EstimateItem } from '@/lib/validations/estimates';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface QuoteBuilderProps {
    jobId: string;
    inventoryItems: InventoryItem[];
    initialData?: {
        items: EstimateItem[];
    } | null;
}

export function QuoteBuilder({ jobId, inventoryItems, initialData }: QuoteBuilderProps) {
    const [items, setItems] = useState<EstimateItem[]>(initialData?.items || []);
    const [isSaving, setIsSaving] = useState(false);
    const [openCombobox, setOpenCombobox] = useState(false);
    const router = useRouter();

    // Reset local state if initialData changes (e.g. after refresh)
    useEffect(() => {
        if (initialData?.items) {
            setItems(initialData.items);
        }
    }, [initialData]);

    const handleAddItem = (inventoryItem?: InventoryItem) => {
        const newItem: EstimateItem = {
            id: crypto.randomUUID(), // Temp ID for key
            description: inventoryItem ? inventoryItem.name : '',
            quantity: 1,
            unit_price: inventoryItem ? inventoryItem.retail_price : 0,
            inventory_item_id: inventoryItem?.id || null,
        };
        setItems([...items, newItem]);
        setOpenCombobox(false);
    };

    const handleUpdateItem = (index: number, field: keyof EstimateItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleDeleteItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Validate basic inputs
            const invalidItems = items.filter(i => !i.description || i.quantity <= 0);
            if (invalidItems.length > 0) {
                toast.error('Please fix invalid items (missing description or invalid quantity)');
                setIsSaving(false);
                return;
            }

            const result = await upsertEstimate(jobId, items);
            if (result.success) {
                toast.success('Quote saved successfully');
                router.refresh();
            } else {
                toast.error(result.error || 'Failed to save quote');
            }
        } catch (error) {
            toast.error('An error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Estimate / Quote
                </h3>
                <Button onClick={handleSave} disabled={isSaving || items.length === 0}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Quote
                </Button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block border rounded-lg overflow-hidden bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40%]">Description</TableHead>
                            <TableHead className="w-[15%]">Qty</TableHead>
                            <TableHead className="w-[20%]">Unit Price</TableHead>
                            <TableHead className="w-[20%] text-right">Total</TableHead>
                            <TableHead className="w-[5%]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No items added. Start by adding a part or custom item.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item, index) => (
                                <TableRow key={item.id || index}>
                                    <TableCell>
                                        <Input
                                            value={item.description}
                                            onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                                            placeholder="Item description"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="pl-7"
                                                value={item.unit_price}
                                                onChange={(e) => handleUpdateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        ${(item.quantity * item.unit_price).toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteItem(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {items.length === 0 ? (
                    <div className="text-center p-8 bg-muted rounded-lg border border-dashed text-muted-foreground">
                        No items added.
                    </div>
                ) : (
                    items.map((item, index) => (
                        <Card key={item.id || index}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start gap-2">
                                    <Input
                                        value={item.description}
                                        onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                                        placeholder="Item description"
                                        className="font-medium"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive shrink-0"
                                        onClick={() => handleDeleteItem(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-muted-foreground">Qty</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="text-base" // Prevent zoom on iOS
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Price</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-500 text-xs">$</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={item.unit_price}
                                                onChange={(e) => handleUpdateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                className="pl-6 text-base"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2 border-t mt-2">
                                    <span className="font-semibold text-sm">
                                        Total: ${(item.quantity * item.unit_price).toFixed(2)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Add Item Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-[250px] justify-start text-muted-foreground">
                            <Plus className="mr-2 h-4 w-4" />
                            Add from Inventory...
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search parts..." />
                            <CommandList>
                                <CommandEmpty>No parts found.</CommandEmpty>
                                <CommandGroup>
                                    {inventoryItems.map((part) => (
                                        <CommandItem
                                            key={part.id}
                                            value={part.name}
                                            onSelect={() => handleAddItem(part)}
                                        >
                                            <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                                            <div className="flex flex-col">
                                                <span>{part.name}</span>
                                                <span className="text-xs text-muted-foreground">SKU: {part.sku} • ${part.retail_price}</span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                <Button variant="secondary" onClick={() => handleAddItem()} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Custom Item
                </Button>
            </div>

            {/* Footer / Grand Total */}
            <div className="flex justify-end p-4 bg-muted/50 rounded-lg border">
                <div className="text-right">
                    <div className="text-sm text-muted-foreground">Grand Total</div>
                    <div className="text-2xl font-bold text-primary">
                        ${calculateTotal().toFixed(2)}
                    </div>
                </div>
            </div>
        </div>
    );
}
