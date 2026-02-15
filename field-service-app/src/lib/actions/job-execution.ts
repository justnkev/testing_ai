'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { JobPart } from '@/lib/validations/inventory';

export type ActionResult<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

// Types
export interface JobEvent {
    id: string;
    job_id: string;
    user_id: string;
    event_type: 'check_in' | 'pause' | 'resume' | 'complete' | 'note';
    latitude: number | null;
    longitude: number | null;
    timestamp: string;
    notes: string | null;
    metadata: Record<string, unknown> | null;
}

export interface JobPhoto {
    id: string;
    job_id: string;
    photo_type: 'before' | 'during' | 'after' | 'other';
    storage_path: string;
    file_name: string;
    file_size: number | null;
    caption: string | null;
    uploaded_at: string;
}

export interface ChecklistItem {
    id: string;
    job_id: string;
    title: string;
    description: string | null;
    is_required: boolean;
    is_completed: boolean;
    completed_at: string | null;
    sort_order: number;
}

export interface JobExecutionData {
    id: string;
    title: string;
    description: string | null;
    status: string;
    scheduled_date: string;
    scheduled_time: string | null;
    check_in_at: string | null;
    completed_at: string | null;
    signature_data: string | null;
    signature_name: string | null;
    signed_at: string | null;
    customer: {
        id: string;
        name: string;
        address: string;
        city: string | null;
        state: string | null;
        zip_code: string | null;
        phone: string | null;
    } | null;
    events: JobEvent[];
    photos: JobPhoto[];
    checklist: ChecklistItem[];
    parts: JobPart[];
}

/**
 * Get full job execution data for mobile view
 */
export async function getJobExecutionData(
    jobId: string
): Promise<ActionResult<JobExecutionData>> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Fetch job with customer
        const { data: job, error: jobError } = await supabase
            .from('fs_jobs')
            .select(`
        id,
        title,
        description,
        status,
        scheduled_date,
        scheduled_time,
        check_in_at,
        completed_at,
        signature_data,
        signature_name,
        signed_at,
        customer:fs_customers (
          id, name, address, city, state, zip_code, phone
        )
      `)
            .eq('id', jobId)
            .single();

        if (jobError || !job) {
            return { success: false, error: 'Job not found' };
        }

        // Fetch events
        const { data: events } = await supabase
            .from('fs_job_events')
            .select('*')
            .eq('job_id', jobId)
            .order('timestamp', { ascending: true });

        // Fetch photos
        const { data: photos } = await supabase
            .from('fs_job_photos')
            .select('*')
            .eq('job_id', jobId)
            .order('uploaded_at', { ascending: true });

        // Fetch checklist
        const { data: checklist } = await supabase
            .from('fs_job_checklists')
            .select('*')
            .eq('job_id', jobId)
            .order('sort_order', { ascending: true });

        // Fetch parts
        const { data: parts } = await supabase
            .from('fs_job_parts')
            .select(`
                *,
                item:fs_inventory_items(name, sku, description)
            `)
            .eq('job_id', jobId)
            .order('created_at', { ascending: true });

        // Handle customer data (might be array from Supabase)
        const customerData = job.customer;
        const customer = Array.isArray(customerData) ? customerData[0] : customerData;

        return {
            success: true,
            data: {
                ...job,
                customer: customer || null,
                events: (events || []) as JobEvent[],
                photos: (photos || []) as JobPhoto[],
                checklist: (checklist || []) as ChecklistItem[],
                parts: (parts || []) as JobPart[],
            },
        };
    } catch (error) {
        console.error('Get job execution data error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Check in to a job - captures location and timestamp
 */
export async function checkInJob(
    jobId: string,
    latitude: number | null,
    longitude: number | null
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const now = new Date().toISOString();

        // Create check-in event
        const { error: eventError } = await supabase.from('fs_job_events').insert({
            job_id: jobId,
            user_id: user.id,
            event_type: 'check_in',
            latitude,
            longitude,
            timestamp: now,
        });

        if (eventError) {
            console.error('Check-in event error:', eventError);
            return { success: false, error: 'Failed to record check-in' };
        }

        // Update job status and check_in_at
        const { error: updateError } = await supabase
            .from('fs_jobs')
            .update({
                status: 'in_progress',
                check_in_at: now,
            })
            .eq('id', jobId);

        if (updateError) {
            console.error('Job update error:', updateError);
            return { success: false, error: 'Failed to update job status' };
        }

        revalidatePath(`/dashboard/jobs/${jobId}/mobile`);
        revalidatePath('/dashboard/calendar');
        revalidatePath('/dashboard');

        return { success: true };
    } catch (error) {
        console.error('Check-in error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Pause a job
 */
export async function pauseJob(
    jobId: string,
    notes?: string
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Create pause event
        const { error: eventError } = await supabase.from('fs_job_events').insert({
            job_id: jobId,
            user_id: user.id,
            event_type: 'pause',
            notes,
            timestamp: new Date().toISOString(),
        });

        if (eventError) {
            console.error('Pause event error:', eventError);
            return { success: false, error: 'Failed to record pause' };
        }

        revalidatePath(`/dashboard/jobs/${jobId}/mobile`);

        return { success: true };
    } catch (error) {
        console.error('Pause error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Resume a paused job
 */
export async function resumeJob(jobId: string): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { error: eventError } = await supabase.from('fs_job_events').insert({
            job_id: jobId,
            user_id: user.id,
            event_type: 'resume',
            timestamp: new Date().toISOString(),
        });

        if (eventError) {
            return { success: false, error: 'Failed to record resume' };
        }

        revalidatePath(`/dashboard/jobs/${jobId}/mobile`);

        return { success: true };
    } catch (error) {
        console.error('Resume error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Complete a job
 */
export async function completeJob(
    jobId: string,
    signatureData: string,
    signatureName: string
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const now = new Date().toISOString();

        // Create complete event
        const { error: eventError } = await supabase.from('fs_job_events').insert({
            job_id: jobId,
            user_id: user.id,
            event_type: 'complete',
            timestamp: now,
        });

        if (eventError) {
            console.error('Complete event error:', eventError);
            return { success: false, error: 'Failed to record completion' };
        }

        // Update job with signature and completion
        const { error: updateError } = await supabase
            .from('fs_jobs')
            .update({
                status: 'completed',
                completed_at: now,
                signature_data: signatureData,
                signature_name: signatureName,
                signed_at: now,
            })
            .eq('id', jobId);

        if (updateError) {
            console.error('Job complete error:', updateError);
            return { success: false, error: 'Failed to complete job' };
        }

        revalidatePath(`/dashboard/jobs/${jobId}/mobile`);
        revalidatePath('/dashboard/calendar');
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/jobs');

        return { success: true };
    } catch (error) {
        console.error('Complete error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Upload a job photo
 */
export async function uploadJobPhoto(
    jobId: string,
    photoType: 'before' | 'during' | 'after' | 'other',
    file: File,
    caption?: string
): Promise<ActionResult<JobPhoto>> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Generate unique filename
        const timestamp = Date.now();
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${jobId}_${timestamp}_${photoType}.${ext}`;
        const storagePath = `${user.id}/${jobId}/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('job-photos')
            .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return { success: false, error: 'Failed to upload photo' };
        }

        // Create photo record
        const { data: photo, error: insertError } = await supabase
            .from('fs_job_photos')
            .insert({
                job_id: jobId,
                user_id: user.id,
                photo_type: photoType,
                storage_path: storagePath,
                file_name: fileName,
                file_size: file.size,
                mime_type: file.type,
                caption,
            })
            .select()
            .single();

        if (insertError) {
            console.error('Photo record error:', insertError);
            return { success: false, error: 'Failed to save photo record' };
        }

        revalidatePath(`/dashboard/jobs/${jobId}/mobile`);

        return { success: true, data: photo as JobPhoto };
    } catch (error) {
        console.error('Photo upload error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Delete a job photo
 */
export async function deleteJobPhoto(photoId: string): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Get photo record first
        const { data: photo, error: fetchError } = await supabase
            .from('fs_job_photos')
            .select('storage_path, job_id')
            .eq('id', photoId)
            .single();

        if (fetchError || !photo) {
            return { success: false, error: 'Photo not found' };
        }

        // Delete from storage
        await supabase.storage.from('job-photos').remove([photo.storage_path]);

        // Delete record
        const { error: deleteError } = await supabase
            .from('fs_job_photos')
            .delete()
            .eq('id', photoId);

        if (deleteError) {
            return { success: false, error: 'Failed to delete photo' };
        }

        revalidatePath(`/dashboard/jobs/${photo.job_id}/mobile`);

        return { success: true };
    } catch (error) {
        console.error('Delete photo error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Update checklist item
 */
export async function updateChecklistItem(
    itemId: string,
    isCompleted: boolean
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const { data: item, error: updateError } = await supabase
            .from('fs_job_checklists')
            .update({
                is_completed: isCompleted,
                completed_at: isCompleted ? new Date().toISOString() : null,
                completed_by: isCompleted ? user.id : null,
            })
            .eq('id', itemId)
            .select('job_id')
            .single();

        if (updateError) {
            return { success: false, error: 'Failed to update checklist' };
        }

        revalidatePath(`/dashboard/jobs/${item?.job_id}/mobile`);

        return { success: true };
    } catch (error) {
        console.error('Checklist update error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Add checklist items to a job
 */
export async function addChecklistItems(
    jobId: string,
    items: { title: string; description?: string; is_required?: boolean }[]
): Promise<ActionResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        const checklistItems = items.map((item, index) => ({
            job_id: jobId,
            title: item.title,
            description: item.description || null,
            is_required: item.is_required || false,
            sort_order: index,
        }));

        const { error } = await supabase
            .from('fs_job_checklists')
            .insert(checklistItems);

        if (error) {
            return { success: false, error: 'Failed to add checklist items' };
        }

        revalidatePath(`/dashboard/jobs/${jobId}/mobile`);

        return { success: true };
    } catch (error) {
        console.error('Add checklist error:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Get photo public URL
 */
export async function getPhotoUrl(storagePath: string): Promise<string> {
    const supabase = await createClient();
    const { data } = supabase.storage.from('job-photos').getPublicUrl(storagePath);
    return data.publicUrl;
}
