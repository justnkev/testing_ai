import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";
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
        .select("*")
        .eq("id", user.id)
        .single();

    const role = profile?.role || user.user_metadata?.role || "user";

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Profile</h1>
                <p className="text-slate-400 mt-1">
                    Manage your account settings and preferences.
                </p>
            </div>
            <Separator />

            <ProfileForm user={user} profile={profile} role={role} />

            {/* Placeholder for future settings sections */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Additional settings content will go here */}
            </div>
        </div>
    );
}
