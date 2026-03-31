'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Box, Search, Loader2, PlusCircle, AlertTriangle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { toast } from 'sonner';
import { getInventoryItems, addPartToJob, removePartFromJob, addCustomPartToJob } from '@/lib/actions/inventory';
import type { InventoryItem, JobPart } from '@/lib/validations/inventory';

interface PartsManagerProps {
    jobId: string;
    parts: JobPart[];
    disabled?: boolean;
    onPartsChange: () => void;
}

export function PartsManager({ jobId, parts, disabled, onPartsChange }: PartsManagerProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [isLoadingInventory, setIsLoadingInventory] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

    // Quick Add state
    const [customName, setCustomName] = useState('');
    const [customPrice, setCustomPrice] = useState('');
    const [customQty, setCustomQty] = useState(1);

    // Fetch inventory when dialog opens
    useEffect(() => {
        if (isDialogOpen && inventory.length === 0) {
            setIsLoadingInventory(true);
            getInventoryItems().then((result) => {
                if (result.success && result.data) {
                    setInventory(result.data);
                }
                setIsLoadingInventory(false);
            });
        }
    }, [isDialogOpen, inventory.length]);

    const handleAddPart = async () => {
        if (!selectedItem) return;

        if (selectedItem.stock_quantity < quantity) {
            toast.error(`Only ${selectedItem.stock_quantity} units available`);
            return;
        }

        setIsAdding(true);
        const result = await addPartToJob(jobId, selectedItem.id, quantity);
        setIsAdding(false);

        if (result.success) {
            toast.success('Part added to job');
            setIsDialogOpen(false);
            setSelectedItem(null);
            setQuantity(1);
            onPartsChange();
        } else {
            toast.error(result.error);
        }
    };

    const handleAddCustomPart = async () => {
        if (!customName.trim() || !customPrice) return;

        setIsAdding(true);
        const result = await addCustomPartToJob(
            jobId,
            customName.trim(),
            parseFloat(customPrice),
            customQty
        );
        setIsAdding(false);

        if (result.success) {
            toast.success('Custom part added (flagged for review)');
            setIsCustomDialogOpen(false);
            setCustomName('');
            setCustomPrice('');
            setCustomQty(1);
            onPartsChange();
        } else if (!result.success) {
            toast.error(result.error);
        }
    };

    const handleRemovePart = async (usageId: string) => {
        if (confirm('Are you sure you want to remove this part? Stock will be restored.')) {
            const result = await removePartFromJob(usageId);
            if (result.success) {
                toast.success('Part removed');
                onPartsChange();
            } else {
                toast.error(result.error);
            }
        }
    };

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Box className="w-5 h-5 text-purple-400" />
                    <h3 className="text-white font-medium">Parts & Materials</h3>
                </div>
                {!disabled && (
                    <div className="flex items-center gap-2">
                        {/* Quick Add Custom Part */}
                        <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-amber-400 hover:bg-amber-500/20 h-8 px-2"
                                    title="Quick Add (not in inventory)"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-700 text-white w-[95vw] max-w-md p-4">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                                        Quick Add Custom Part
                                    </DialogTitle>
                                </DialogHeader>
                                <p className="text-xs text-amber-400/70">
                                    For parts not in inventory. Will be flagged for admin review.
                                </p>
                                <div className="space-y-3 mt-3">
                                    <div>
                                        <label className="text-sm text-slate-400">Part Name</label>
                                        <Input
                                            placeholder="e.g. 14/2 Romex 100ft"
                                            value={customName}
                                            onChange={(e) => setCustomName(e.target.value)}
                                            className="bg-slate-800 border-slate-600 mt-1"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-sm text-slate-400">Est. Price ($)</label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                placeholder="0.00"
                                                value={customPrice}
                                                onChange={(e) => setCustomPrice(e.target.value)}
                                                className="bg-slate-800 border-slate-600 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-slate-400">Quantity</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={customQty}
                                                onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                                                className="bg-slate-800 border-slate-600 mt-1"
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleAddCustomPart}
                                        className="w-full bg-amber-600 hover:bg-amber-700"
                                        disabled={!customName.trim() || !customPrice || isAdding}
                                    >
                                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Custom Part'}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* Standard Inventory Add */}
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/20">
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Part
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-700 text-white w-[95vw] max-w-md p-4">
                                <DialogHeader>
                                    <DialogTitle>Add Part from Inventory</DialogTitle>
                                </DialogHeader>

                                <div className="space-y-4 mt-4">
                                    {/* Item Selection */}
                                    <div className="space-y-2">
                                        <label className="text-sm text-slate-400">Select Item</label>
                                        <Command className="bg-slate-800 border border-slate-700 rounded-lg">
                                            <CommandInput placeholder="Search parts..." className="h-11" />
                                            <CommandList className="max-h-[200px]">
                                                <CommandEmpty>
                                                    {isLoadingInventory ? 'Loading...' : (
                                                        <div className="py-3 text-center">
                                                            <p className="text-sm text-slate-400">No parts found.</p>
                                                            <button
                                                                className="text-xs text-amber-400 hover:text-amber-300 mt-1 underline"
                                                                onClick={() => {
                                                                    setIsDialogOpen(false);
                                                                    setIsCustomDialogOpen(true);
                                                                }}
                                                            >
                                                                Quick Add a custom part instead →
                                                            </button>
                                                        </div>
                                                    )}
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {inventory.map((item) => (
                                                        <CommandItem
                                                            key={item.id}
                                                            value={`${item.name} ${item.sku}`}
                                                            onSelect={() => setSelectedItem(item)}
                                                            className="data-[selected=true]:bg-slate-700 cursor-pointer"
                                                        >
                                                            <div className="flex justify-between w-full items-center">
                                                                <div className="flex flex-col">
                                                                    <span className="text-white">{item.name}</span>
                                                                    <span className="text-xs text-slate-400">{item.sku}</span>
                                                                </div>
                                                                <Badge variant="secondary" className={item.stock_quantity < 5 ? 'text-amber-400' : 'text-slate-300'}>
                                                                    {item.stock_quantity} left
                                                                </Badge>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </div>

                                    {selectedItem && (
                                        <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                            <p className="text-sm font-medium text-purple-300 mb-2">Selected: {selectedItem.name}</p>
                                            <div className="flex items-center gap-3">
                                                <label className="text-sm text-slate-300">Quantity:</label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max={selectedItem.stock_quantity}
                                                    value={quantity}
                                                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                                    className="w-20 bg-slate-800 border-slate-600 h-9"
                                                />
                                                <span className="text-xs text-slate-500">
                                                    (Max {selectedItem.stock_quantity})
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleAddPart}
                                        className="w-full bg-purple-600 hover:bg-purple-700"
                                        disabled={!selectedItem || isAdding}
                                    >
                                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to Job'}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                )}
            </div>

            {/* Parts List */}
            {parts.length === 0 ? (
                <div className="text-center py-4 border border-dashed border-slate-700 rounded-lg">
                    <p className="text-sm text-slate-500">No parts added yet.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {parts.map((part) => (
                        <div key={part.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-white font-medium text-sm">
                                        {part.is_custom_entry ? part.custom_item_name : part.item?.name}
                                    </p>
                                    {part.is_custom_entry && !part.admin_reviewed && (
                                        <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">
                                            Needs Review
                                        </Badge>
                                    )}
                                    {part.is_custom_entry && part.admin_reviewed && (
                                        <Badge variant="outline" className="text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
                                            Approved
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400">
                                    Qty: {part.quantity_used} × ${part.is_custom_entry
                                        ? (part.custom_item_price ?? 0).toFixed(2)
                                        : part.unit_price_at_time_of_use.toFixed(2)}
                                </p>
                            </div>
                            {!disabled && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-slate-500 hover:text-red-400"
                                    onClick={() => handleRemovePart(part.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                    <div className="pt-2 border-t border-slate-700 flex justify-between text-sm">
                        <span className="text-slate-400">Total Parts Cost:</span>
                        <span className="text-white font-medium">
                            ${parts.reduce((acc, p) => {
                                const price = p.is_custom_entry
                                    ? (p.custom_item_price ?? 0)
                                    : p.unit_price_at_time_of_use;
                                return acc + (p.quantity_used * price);
                            }, 0).toFixed(2)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
