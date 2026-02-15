'use server';

import { createClient } from '@/lib/supabase/server';

interface Estimate {
    id: string;
    job_id: string;
    customer_id: string;
    status: 'pending' | 'approved' | 'declined' | 'expired';
    total_amount: number;
    description: string | null;
    line_items: any;
    signature_data: string | null;
    signature_name: string | null;
    signed_at: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Get all estimates for a customer
 * @param customerId - UUID of the customer
 * @returns List of estimates
 */
export async function getEstimatesByCustomer(
    customerId: string
): Promise<{ success: boolean; estimates?: Estimate[]; error?: string }> {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('estimates')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching estimates:', error);
            return { success: false, error: 'Failed to fetch estimates' };
        }

        return { success: true, estimates: data || [] };
    } catch (error) {
        console.error('Error in getEstimatesByCustomer:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Get a single estimate by ID (with customer validation)
 * @param estimateId - UUID of the estimate
 * @param customerId - UUID of the customer (for authorization)
 * @returns Estimate data
 */
export async function getEstimateById(
    estimateId: string,
    customerId: string
): Promise<{ success: boolean; estimate?: Estimate; error?: string }> {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('estimates')
            .select('*')
            .eq('id', estimateId)
            .eq('customer_id', customerId)
            .single();

        if (error || !data) {
            console.error('Error fetching estimate:', error);
            return { success: false, error: 'Estimate not found' };
        }

        return { success: true, estimate: data };
    } catch (error) {
        console.error('Error in getEstimateById:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Approve an estimate with signature
 * @param estimateId - UUID of the estimate
 * @param customerId - UUID of the customer (for authorization)
 * @param signatureData - Base64 signature image
 * @param signerName - Name of person signing
 * @returns Success status
 */
export async function approveEstimate(
    estimateId: string,
    customerId: string,
    signatureData: string,
    signerName: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        // Verify estimate belongs to customer
        const { data: estimate, error: fetchError } = await supabase
            .from('estimates')
            .select('id, status')
            .eq('id', estimateId)
            .eq('customer_id', customerId)
            .single();

        if (fetchError || !estimate) {
            return { success: false, error: 'Estimate not found' };
        }

        if (estimate.status !== 'pending') {
            return { success: false, error: 'Estimate has already been processed' };
        }

        // Update estimate with approval and signature
        const { error: updateError } = await supabase
            .from('estimates')
            .update({
                status: 'approved',
                signature_data: signatureData,
                signature_name: signerName,
                signed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', estimateId);

        if (updateError) {
            console.error('Error approving estimate:', updateError);
            return { success: false, error: 'Failed to approve estimate' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error in approveEstimate:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}

/**
 * Decline an estimate
 * @param estimateId - UUID of the estimate
 * @param customerId - UUID of the customer (for authorization)
 * @returns Success status
 */
export async function declineEstimate(
    estimateId: string,
    customerId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        // Verify estimate belongs to customer
        const { data: estimate, error: fetchError } = await supabase
            .from('estimates')
            .select('id, status')
            .eq('id', estimateId)
            .eq('customer_id', customerId)
            .single();

        if (fetchError || !estimate) {
            return { success: false, error: 'Estimate not found' };
        }

        if (estimate.status !== 'pending') {
            return { success: false, error: 'Estimate has already been processed' };
        }

        // Update estimate status to declined
        const { error: updateError } = await supabase
            .from('estimates')
            .update({
                status: 'declined',
                updated_at: new Date().toISOString(),
            })
            .eq('id', estimateId);

        if (updateError) {
            console.error('Error declining estimate:', updateError);
            return { success: false, error: 'Failed to decline estimate' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error in declineEstimate:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}
