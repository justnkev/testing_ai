'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface MarketingTemplate {
    id: string;
    name: string;
    subject: string;
    email_body: string;
    sms_body: string;
    is_active: boolean;
    trigger_days_after: number;
}

export default function MarketingSettingsPage() {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Global Settings
    const [marketingEnabled, setMarketingEnabled] = useState(false);
    const [reviewUrl, setReviewUrl] = useState('');

    // Templates
    const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<MarketingTemplate | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setIsLoading(true);
        // Load Business Settings
        const { data: settings } = await supabase.from('business_settings').select('marketing_enabled, google_review_url').single();
        if (settings) {
            setMarketingEnabled(settings.marketing_enabled || false);
            setReviewUrl(settings.google_review_url || '');
        }

        // Load Templates
        const { data: tmpls } = await supabase.from('marketing_templates').select('*').order('name');
        if (tmpls) {
            setTemplates(tmpls as MarketingTemplate[]);
        }
        setIsLoading(false);
    }

    async function handleSaveSettings() {
        setIsSaving(true);
        // Update DB (assuming single row in business_settings for now, or use ID if available in real app)
        // With single() select, we might need ID for update. Assuming ID exists or we update roughly.
        // Better pattern: fetch ID first or blindly update first row.
        const { data: existing } = await supabase.from('business_settings').select('id').single();

        if (existing) {
            const { error } = await supabase.from('business_settings').update({
                marketing_enabled: marketingEnabled,
                google_review_url: reviewUrl
            }).eq('id', existing.id);

            if (error) toast.error('Failed to save settings');
            else toast.success('Settings saved');
        }
        setIsSaving(false);
    }

    async function handleUpdateTemplate(template: MarketingTemplate) {
        const { error } = await supabase.from('marketing_templates').update({
            subject: template.subject,
            email_body: template.email_body,
            sms_body: template.sms_body,
            is_active: template.is_active,
            trigger_days_after: template.trigger_days_after
        }).eq('id', template.id);

        if (error) {
            toast.error('Failed to update template');
        } else {
            toast.success('Template updated');
            setEditingTemplate(null);
            loadData(); // Refresh
        }
    }

    const testEmailAddress = 'me@example.com';
    // In real app, would prompt or use current user email.

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-white" /></div>;
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Marketing Automation</h1>
                <p className="text-slate-400">Manage review requests and service reminders.</p>
            </div>

            {/* Global Settings */}
            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">General Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-700">
                        <div className="space-y-0.5">
                            <Label className="text-base text-white">Enable Marketing Automation</Label>
                            <p className="text-sm text-slate-400">
                                When enabled, automated emails/SMS will be sent based on template triggers.
                            </p>
                        </div>
                        <Switch
                            checked={marketingEnabled}
                            onCheckedChange={setMarketingEnabled}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-white">Google Review URL</Label>
                        <Input
                            className="bg-slate-900 border-slate-700 text-white"
                            placeholder="https://g.page/r/..."
                            value={reviewUrl}
                            onChange={e => setReviewUrl(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">
                            This link will be used in the {`{{review_url}}`} tag.
                        </p>
                    </div>
                    <Button onClick={handleSaveSettings} disabled={isSaving} className="bg-blue-600">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Settings
                    </Button>
                </CardContent>
            </Card>

            {/* Templates */}
            <h2 className="text-xl font-bold text-white mt-8">Message Templates</h2>
            <div className="grid gap-6 md:grid-cols-2">
                {templates.map(template => (
                    <Card key={template.id} className="bg-slate-800 border-slate-700 flex flex-col">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-white text-lg">{template.name}</CardTitle>
                                    <CardDescription className="text-slate-400">
                                        Triggers {template.trigger_days_after} day(s) after event
                                    </CardDescription>
                                </div>
                                <Switch
                                    checked={template.is_active}
                                    onCheckedChange={async (val: boolean) => {
                                        // Quick toggle
                                        await supabase.from('marketing_templates').update({ is_active: val }).eq('id', template.id);
                                        toast.success(`Template ${val ? 'enabled' : 'disabled'}`);
                                        loadData();
                                    }}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 uppercase">Subject</Label>
                                <p className="text-sm text-slate-200 font-medium truncate">{template.subject}</p>
                            </div>

                            <div className="pt-4 mt-auto">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button className="w-full bg-slate-700 text-white hover:bg-slate-600">
                                            Edit Template
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>Edit {template.name}</DialogTitle>
                                            <DialogDescription>
                                                You can use tags: {`{{customer_name}}, {{business_name}}, {{review_url}}`}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Trigger Delay (Days)</Label>
                                                <Input
                                                    type="number"
                                                    className="bg-slate-800 border-slate-700"
                                                    defaultValue={template.trigger_days_after}
                                                    onChange={(e) => template.trigger_days_after = parseInt(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Email Subject</Label>
                                                <Input
                                                    className="bg-slate-800 border-slate-700"
                                                    defaultValue={template.subject}
                                                    onChange={(e) => template.subject = e.target.value}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Email Body (HTML)</Label>
                                                <Textarea
                                                    className="bg-slate-800 border-slate-700 min-h-[200px] font-mono text-sm"
                                                    defaultValue={template.email_body || ''}
                                                    onChange={(e) => template.email_body = e.target.value}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>SMS Body</Label>
                                                <Textarea
                                                    className="bg-slate-800 border-slate-700 min-h-[100px]"
                                                    defaultValue={template.sms_body || ''}
                                                    onChange={(e) => template.sms_body = e.target.value}
                                                />
                                            </div>
                                            <Button onClick={() => handleUpdateTemplate(template)} className="w-full bg-blue-600">
                                                Save Changes
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
