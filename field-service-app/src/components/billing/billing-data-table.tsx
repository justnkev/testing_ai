'use client';

import * as React from 'react';
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronDown, MoreHorizontal, AlertTriangle } from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BillingDashboardRecord } from '@/lib/actions/billing';
import { format } from 'date-fns';
import Link from 'next/link';

interface BillingDataTableProps {
    data: BillingDashboardRecord[];
    onRowSelectionChange: (selectedRows: BillingDashboardRecord[]) => void;
}

export function BillingDataTable({ data, onRowSelectionChange }: BillingDataTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    // Formatting Helpers
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const StatusBadge = ({ status, payment_status, isUnbilled, hasMissingCosts }: any) => {
        if (isUnbilled) {
            return (
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Unbilled
                    </span>
                    {hasMissingCosts && (
                        <span title="Missing Labor/Parts">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                        </span>
                    )}
                </div>
            );
        }

        if (payment_status === 'paid') {
            return (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Paid
                </span>
            );
        }

        if (payment_status === 'partial') {
            return (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    Partial
                </span>
            );
        }

        if (status === 'overdue') {
            return (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                    Overdue
                </span>
            );
        }

        if (status === 'draft') {
            return (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                    Draft
                </span>
            );
        }

        return (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {status || 'Pending'}
            </span>
        );
    };

    const columns: ColumnDef<BillingDashboardRecord>[] = [
        {
            id: 'select',
            header: ({ table }) => (
                <input
                    type="checkbox"
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    checked={row.getIsSelected()}
                    onChange={(e) => row.toggleSelected(!!e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: 'display_id',
            header: 'Invoice #',
            cell: ({ row }) => {
                const record = row.original;
                const isInvoice = record.record_type === 'invoice';
                const href = isInvoice ? `/dashboard/invoices/${record.id}` : `/dashboard/jobs/${record.id}`;
                return (
                    <Link href={href} className="font-medium text-blue-400 hover:text-blue-300 hover:underline">
                        {row.getValue('display_id')}
                    </Link>
                );
            },
        },
        {
            accessorKey: 'customer_name',
            header: 'Customer',
            cell: ({ row }) => <div>{row.getValue('customer_name')}</div>,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
                <StatusBadge 
                    status={row.original.status} 
                    payment_status={row.original.payment_status}
                    isUnbilled={row.original.record_type === 'unbilled_job'}
                    hasMissingCosts={row.original.has_missing_costs}
                />
            ),
        },
        {
            accessorKey: 'created_at',
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        className="p-0 hover:bg-transparent text-slate-400 hover:text-white"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    >
                        Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => <div>{format(new Date(row.getValue('created_at')), 'MMM d, yyyy')}</div>,
        },
        {
            accessorKey: 'days_aging',
            header: 'Aging',
            cell: ({ row }) => {
                const val = row.getValue('days_aging') as number | null;
                if (val !== null) {
                    return <div className={val > 30 ? 'text-amber-500' : 'text-slate-400'}>{val} Days</div>;
                }
                return <div className="text-slate-600">-</div>;
            },
        },
        {
            accessorKey: 'total_amount',
            header: () => <div className="text-right">Total</div>,
            cell: ({ row }) => {
                const val = row.getValue('total_amount');
                const total = val != null ? parseFloat(val as string) : 0;
                return (
                    <div className="text-right font-medium">
                        {formatCurrency(total)}
                    </div>
                )
            },
        },
        {
            accessorKey: 'balance_due',
            header: () => <div className="text-right">Balance Due</div>,
            cell: ({ row }) => {
                const val = row.getValue('balance_due');
                const balance = val != null ? parseFloat(val as string) : (row.original.total_amount || 0);
                return (
                    <div className={`text-right font-medium ${balance > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {formatCurrency(balance)}
                    </div>
                )
            },
        },
    ];

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    });

    // Notify parent component when row selection changes
    React.useEffect(() => {
        const selectedRows = table.getSelectedRowModel().rows.map(row => row.original);
        onRowSelectionChange(selectedRows);
    }, [rowSelection, table, onRowSelectionChange]);

    // Clear selection when data changes (e.g. changing tabs)
    React.useEffect(() => {
        setRowSelection({});
    }, [data]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Input
                    placeholder="Search customers..."
                    value={(table.getColumn('customer_name')?.getFilterValue() as string) ?? ''}
                    onChange={(event) =>
                        table.getColumn('customer_name')?.setFilterValue(event.target.value)
                    }
                    className="max-w-sm bg-slate-800 border-slate-700 text-white"
                />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="ml-auto bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white">
                            Columns <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-slate-300">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => {
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize focus:bg-slate-700"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {column.id.replace('_', ' ')}
                                    </DropdownMenuCheckboxItem>
                                )
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-800/50 overflow-hidden">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="bg-slate-800/80 border-b border-slate-700 text-slate-400">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <th key={header.id} className="h-10 px-4 align-middle font-medium">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </th>
                                    )
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className={`hover:bg-slate-700/30 transition-colors ${row.getIsSelected() ? 'bg-blue-900/20' : ''}`}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="p-4 align-middle">
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="h-24 text-center text-slate-500"
                                >
                                    No records found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-slate-500">
                    {table.getFilteredSelectedRowModel().rows.length} of{' '}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
