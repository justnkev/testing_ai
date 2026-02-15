'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateOrganization } from '@/lib/actions/organization';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface OrgSettingsProps {
    initialData: {
        name: string;
        support_email?: string;
        brand_color?: string;
    };
}

export function OrganizationSettingsForm({ initialData }: OrgSettingsProps) {
    const [isPending, setIsPending] = useState(false);

    async function handleSubmit(formData: FormData) {
        setIsPending(true);
        try {
            const result = await updateOrganization(null, formData);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(result.success);
            }
        } catch (err) {
            toast.error('Something went wrong');
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card className="bg-slate-800 border-slate-700 text-white">
            <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription className="text-slate-400">
                    Update your company information and branding.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form action={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Company Name</Label>
                        <Input
                            id="name"
                            name="name"
                            defaultValue={initialData.name}
                            required
                            className="bg-slate-900 border-slate-700"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="supportEmail">Support Email</Label>
                        <Input
                            id="supportEmail"
                            name="supportEmail"
                            type="email"
                            defaultValue={initialData.support_email}
                            className="bg-slate-900 border-slate-700"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="brandColor">Brand Color</Label>
                        <div className="flex gap-2">
                            <Input
                                id="brandColor"
                                name="brandColor"
                                type="color"
                                defaultValue={initialData.brand_color || '#3b82f6'}
                                className="w-16 h-10 p-1 bg-slate-900 border-slate-700 cursor-pointer"
                            />
                            <Input
                                type="text"
                                defaultValue={initialData.brand_color || '#3b82f6'}
                                className="bg-slate-900 border-slate-700 font-mono"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Optional: Sync with color picker if valid hex
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
