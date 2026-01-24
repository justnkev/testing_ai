import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User } from "@supabase/supabase-js";

interface SettingsProfileCardProps {
    user: User;
    role?: string;
}

export function SettingsProfileCard({ user, role }: SettingsProfileCardProps) {
    const fullName = user.user_metadata?.full_name || 'User';
    const email = user.email || 'No email';

    // Get initials
    const initials = fullName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

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

                    <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-1">
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
                </div>
            </CardContent>
        </Card>
    );
}
