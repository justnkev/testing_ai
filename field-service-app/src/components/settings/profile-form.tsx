'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { updateProfile, resetPassword } from '@/lib/actions/profile';
import { Loader2, Lock, User as UserIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const profileSchema = z.object({
    display_name: z.string().min(2, 'Name must be at least 2 characters'),
    username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    address: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
    user: any;
    profile: any;
    role: string;
}

export function ProfileForm({ user, profile, role }: ProfileFormProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            display_name: profile?.display_name || user.user_metadata?.full_name || '',
            username: profile?.username || '',
            email: user.email || '',
            phone: profile?.phone || '',
            address: profile?.address || '',
        },
    });

    async function onSubmit(data: ProfileFormValues) {
        setIsSaving(true);
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            if (value) formData.append(key, value);
        });

        const result = await updateProfile(formData);

        if (result?.error) {
            toast.error(result.error);
        } else {
            toast.success('Profile updated successfully');
        }
        setIsSaving(false);
    }

    async function handlePasswordReset() {
        setIsResetting(true);
        const result = await resetPassword();
        if (result?.error) {
            toast.error(result.error);
        } else {
            toast.success('Password reset email sent');
        }
        setIsResetting(false);
    }

    const fullName = form.watch('display_name') || 'User';
    const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="grid gap-6">
            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">Personal Information</CardTitle>
                    <CardDescription className="text-slate-400">
                        Update your personal details and contact information.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Avatar Section */}
                        <div className="flex flex-col items-center space-y-4">
                            <Avatar className="h-24 w-24 border-2 border-slate-700">
                                <AvatarImage src={user.user_metadata?.avatar_url} />
                                <AvatarFallback className="text-2xl bg-slate-700 text-white">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <Badge variant="outline" className="capitalize border-slate-600 text-slate-300">
                                {role}
                            </Badge>
                        </div>

                        {/* Form Section */}
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-white">Display Name</Label>
                                    <Input
                                        {...form.register('display_name')}
                                        className="bg-slate-900 border-slate-700 text-white"
                                    />
                                    {form.formState.errors.display_name && (
                                        <p className="text-xs text-red-400">{form.formState.errors.display_name.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white">Username</Label>
                                    <Input
                                        {...form.register('username')}
                                        className="bg-slate-900 border-slate-700 text-white"
                                        placeholder="unique_username"
                                    />
                                    {form.formState.errors.username && (
                                        <p className="text-xs text-red-400">{form.formState.errors.username.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white">Email</Label>
                                    <Input
                                        {...form.register('email')}
                                        className="bg-slate-900 border-slate-700 text-white"
                                    />
                                    <p className="text-xs text-slate-500">Changing email may require verification.</p>
                                    {form.formState.errors.email && (
                                        <p className="text-xs text-red-400">{form.formState.errors.email.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-white">Phone</Label>
                                    <Input
                                        {...form.register('phone')}
                                        className="bg-slate-900 border-slate-700 text-white"
                                        placeholder="+1 (555) 000-0000"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-white">Address</Label>
                                <Input
                                    {...form.register('address')}
                                    className="bg-slate-900 border-slate-700 text-white"
                                    placeholder="123 Main St, City, State"
                                />
                            </div>

                            {/* Read-Only Role Field explicitly shown as requested */}
                            <div className="space-y-2">
                                <Label className="text-slate-400">Role (Read-Only)</Label>
                                <div className="p-2 bg-slate-900/50 border border-slate-700 rounded-md text-slate-400 text-sm capitalize flex items-center gap-2">
                                    <Lock className="w-3 h-3" />
                                    {role}
                                </div>
                            </div>

                            <Separator className="bg-slate-700" />

                            <div className="flex justify-between items-center">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-slate-400 hover:text-white"
                                    onClick={handlePasswordReset}
                                    disabled={isResetting}
                                >
                                    {isResetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                                    Reset Password
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSaving}
                                    className="bg-slate-700 hover:bg-slate-600 text-white"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Changes'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}
