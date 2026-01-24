import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsProfileCard } from "@/components/dashboard/settings-profile-card";
import { Separator } from "@/components/ui/separator";

export default async function SettingsPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch the role from the profiles table or metadata
    // We'll prioritize the profiles table for the most up-to-date role
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    const role = profile?.role || user.user_metadata?.role || "user";

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Profile</h3>
                <p className="text-sm text-muted-foreground">
                    Manage your account settings and preferences.
                </p>
            </div>
            <Separator />

            <SettingsProfileCard user={user} role={role} />

            {/* Placeholder for future settings sections */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Additional settings content will go here */}
            </div>
        </div>
    );
}
