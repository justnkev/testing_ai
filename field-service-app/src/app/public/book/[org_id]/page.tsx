'use client';

// Force dynamic rendering so we can read the org_id regardless of build time
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { submitLead } from '@/lib/actions/public-leads';
import { toast } from 'sonner';

// Validations (Matching server-side roughly)
const contactSchema = z.object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Valid phone number is required'),
    address: z.string().min(5, 'Address is required'),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    zip_code: z.string().min(5, 'ZIP code is required'),
});

const serviceSchema = z.object({
    title: z.string().min(3, 'Service needed is required'),
    description: z.string().optional(),
    preferred_date: z.string().min(1, 'Date is required'),
    preferred_time: z.string().optional(),
});

type ContactData = z.infer<typeof contactSchema>;
type ServiceData = z.infer<typeof serviceSchema>;

export default function BookingPage({ params }: { params: { org_id: string } }) {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Forms
    const contactForm = useForm<ContactData>({ resolver: zodResolver(contactSchema) });
    const serviceForm = useForm<ServiceData>({ resolver: zodResolver(serviceSchema) });

    // Handle steps
    const handleNext = async () => {
        const isValid = await contactForm.trigger();
        if (isValid) setStep(2);
    };

    const handleBack = () => setStep(1);

    const onSubmit = async () => {
        const isServiceValid = await serviceForm.trigger();
        if (!isServiceValid) return;

        setIsSubmitting(true);
        const contactData = contactForm.getValues();
        const serviceData = serviceForm.getValues();

        const result = await submitLead({
            org_id: params.org_id,
            contact: contactData,
            service: serviceData,
            honeypot: '', // Leave empty
        });

        if (result.success) {
            setIsSuccess(true);
        } else {
            toast.error(result.error || 'Something went wrong. Please try again.');
        }
        setIsSubmitting(false);
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full text-center p-8 bg-white shadow-lg border-slate-200">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Received!</h2>
                    <p className="text-slate-600 mb-6">
                        Thank you for contacting us. Our team has received your request and will be in touch shortly to confirm your appointment.
                    </p>
                    <Button onClick={() => window.location.reload()} variant="outline">
                        Submit Another Request
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
            <Card className="max-w-lg w-full bg-white shadow-xl border-slate-200 overflow-hidden">
                <div className="h-2 bg-slate-200 w-full">
                    <motion.div
                        className="h-full bg-blue-600"
                        initial={{ width: '0%' }}
                        animate={{ width: step === 1 ? '50%' : '100%' }}
                    />
                </div>

                <CardHeader>
                    <CardTitle className="text-xl md:text-2xl text-slate-900">
                        {step === 1 ? 'Contact Information' : 'Service Details'}
                    </CardTitle>
                    <CardDescription>
                        {step === 1 ? 'Tell us about yourself' : 'How can we help you?'}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-4"
                            >
                                <div className="space-y-2">
                                    <Label className="text-slate-700">Full Name</Label>
                                    <Input {...contactForm.register('name')} placeholder="John Doe" className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-blue-500" />
                                    {contactForm.formState.errors.name && <p className="text-red-500 text-sm">{contactForm.formState.errors.name.message}</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-700">Email</Label>
                                        <Input {...contactForm.register('email')} placeholder="email@example.com" className="bg-white border-slate-300 text-slate-900" />
                                        {contactForm.formState.errors.email && <p className="text-red-500 text-sm">{contactForm.formState.errors.email.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700">Phone</Label>
                                        <Input {...contactForm.register('phone')} placeholder="(555) 000-0000" className="bg-white border-slate-300 text-slate-900" />
                                        {contactForm.formState.errors.phone && <p className="text-red-500 text-sm">{contactForm.formState.errors.phone.message}</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-slate-700">Address</Label>
                                    <Input {...contactForm.register('address')} placeholder="123 Main St" className="bg-white border-slate-300 text-slate-900" />
                                    {contactForm.formState.errors.address && <p className="text-red-500 text-sm">{contactForm.formState.errors.address.message}</p>}
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-slate-700">City</Label>
                                        <Input {...contactForm.register('city')} className="bg-white border-slate-300 text-slate-900" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700">State</Label>
                                        <Input {...contactForm.register('state')} className="bg-white border-slate-300 text-slate-900" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700">ZIP</Label>
                                        <Input {...contactForm.register('zip_code')} className="bg-white border-slate-300 text-slate-900" />
                                    </div>
                                </div>

                                <Button onClick={handleNext} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">
                                    Next Step <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div className="space-y-2">
                                    <Label className="text-slate-700">Service Needed</Label>
                                    <Input {...serviceForm.register('title')} placeholder="e.g. Leaky Faucet Repair" className="bg-white border-slate-300 text-slate-900" />
                                    {serviceForm.formState.errors.title && <p className="text-red-500 text-sm">{serviceForm.formState.errors.title.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-slate-700">Details (Optional)</Label>
                                    <Textarea {...serviceForm.register('description')} placeholder="Please describe the issue..." className="bg-white border-slate-300 text-slate-900 min-h-[100px]" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-700">Preferred Date</Label>
                                        <Input type="date" {...serviceForm.register('preferred_date')} className="bg-white border-slate-300 text-slate-900" />
                                        {serviceForm.formState.errors.preferred_date && <p className="text-red-500 text-sm">{serviceForm.formState.errors.preferred_date.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-700">Preferred Time</Label>
                                        <Input type="time" {...serviceForm.register('preferred_time')} className="bg-white border-slate-300 text-slate-900" />
                                    </div>
                                </div>

                                {/* Honeypot - Hidden from humans */}
                                <input type="text" name="honeypot" className="hidden" tabIndex={-1} autoComplete="off" />

                                <div className="flex gap-3 mt-6">
                                    <Button variant="outline" onClick={handleBack} className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-100">
                                        <ChevronLeft className="w-4 h-4 mr-2" /> Back
                                    </Button>
                                    <Button onClick={onSubmit} disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Request'}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>

            <div className="fixed bottom-4 text-center w-full pointer-events-none">
                <p className="text-xs text-slate-400">Powered by Field Service App</p>
            </div>
        </div>
    );
}
