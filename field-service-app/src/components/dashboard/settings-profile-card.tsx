import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { getStripeAccountStatus, createAccountLink } from "@/lib/stripe/actions";
import { CheckCircle, CreditCard } from "lucide-react";

interface SettingsProfileCardProps {
    user: User;
    role?: string;
}

export async function SettingsProfileCard({ user, role }: SettingsProfileCardProps) {
    const fullName = user.user_metadata?.full_name || 'User';
    const email = user.email || 'No email';
    const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    let stripeStatus = null;
    if (role === 'technician') {
        stripeStatus = await getStripeAccountStatus();
    }

    return (
        <Card className="mb-6">
            <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={user.user_metadata?.avatar_url} alt={fullName} />
                        <AvatarFallback className="text-xl bg-primary/10 text-primary">
                            {initials}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold tracking-tight">{fullName}</h2>
                            {role && (
                                <Badge variant="secondary" className="capitalize">
                                    {role}
                                </Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground">{email}</p>
                    </div>

                    {role === 'technician' && (
                        <div className="mt-4 sm:mt-0 border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 sm:pl-6 flex flex-col items-center sm:items-end gap-2">
                            {stripeStatus?.isConnected ? (
                                <div className="flex items-center gap-2 text-green-600 font-medium bg-green-50 px-3 py-1.5 rounded-full">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Payouts Active</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center sm:items-end gap-2">
                                    <p className="text-sm text-muted-foreground text-center sm:text-right max-w-[200px]">
                                        Connect Stripe to receive payments.
                                    </p>
                                    <form action={createAccountLink}>
                                        <Button size="sm" className="gap-2">
                                            <CreditCard className="h-4 w-4" />
                                            {stripeStatus?.accountId ? 'Data pending - Resume Setup' : 'Connect Stripe'}
                                        </Button>
                                    </form>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
