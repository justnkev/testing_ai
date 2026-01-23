import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse form data
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const jobId = formData.get('jobId') as string;
        const photoType = formData.get('photoType') as 'before' | 'during' | 'after' | 'other';
        const caption = formData.get('caption') as string | undefined;

        if (!file || !jobId || !photoType) {
            return NextResponse.json(
                { error: 'Missing required fields: file, jobId, photoType' },
                { status: 400 }
            );
        }

        console.log('[Photo Upload] Processing:', { jobId, photoType, fileName: file.name, size: file.size });

        // Generate unique filename
        const timestamp = Date.now();
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${jobId}_${timestamp}_${photoType}.${ext}`;
        const storagePath = `${user.id}/${jobId}/${fileName}`;

        // Convert File to ArrayBuffer for upload
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('job-photos')
            .upload(storagePath, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('[Photo Upload] Storage error:', uploadError);
            return NextResponse.json(
                { error: `Storage upload failed: ${uploadError.message}` },
                { status: 500 }
            );
        }

        console.log('[Photo Upload] File uploaded to storage:', storagePath);

        // Create photo record in database
        const { data: photo, error: insertError } = await supabase
            .from('fs_job_photos')
            .insert({
                job_id: jobId,
                user_id: user.id,
                photo_type: photoType,
                storage_path: storagePath,
                file_name: fileName,
                file_size: file.size,
                caption: caption || null,
            })
            .select()
            .single();

        if (insertError) {
            console.error('[Photo Upload] Database error:', insertError);
            // Try to clean up the uploaded file
            await supabase.storage.from('job-photos').remove([storagePath]);
            return NextResponse.json(
                { error: `Database insert failed: ${insertError.message}` },
                { status: 500 }
            );
        }

        console.log('[Photo Upload] Success! Photo ID:', photo.id);

        return NextResponse.json({
            success: true,
            photo: {
                id: photo.id,
                storage_path: photo.storage_path,
                file_name: photo.file_name,
                photo_type: photo.photo_type,
            },
        });
    } catch (error) {
        console.error('[Photo Upload] Unexpected error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
