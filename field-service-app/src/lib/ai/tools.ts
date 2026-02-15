import { z } from 'zod';
import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { createJob, updateJob, getUpcomingJobs } from '@/lib/actions/jobs';
import { getCustomers } from '@/lib/actions/customers';

// Helper to safely execute a tool function and always return a string
async function safeExecute<T>(fn: () => Promise<T>): Promise<string> {
    try {
        const result = await fn();
        return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (error: any) {
        console.error('[Tool Error]', error?.message || error);
        return `Error: ${error?.message || 'An unexpected error occurred'}`;
    }
}

export const tools = {
    lookupCustomer: tool({
        description: 'Look up customers by name to find their ID. Always use this before creating a job to get the correct customer_id UUID. Returns a list of matching customers.',
        inputSchema: z.object({
            searchName: z.string().describe('Name or partial name to search for'),
        }),
        execute: async ({ searchName }) => {
            return safeExecute(async () => {
                const result = await getCustomers();
                if (!result.success || !result.data) {
                    return `Error: ${result.error || 'Failed to fetch customers'}`;
                }
                const matches = result.data.filter((c: any) =>
                    c.name?.toLowerCase().includes(searchName.toLowerCase())
                );
                if (matches.length === 0) {
                    return `No customers found matching "${searchName}". Available customers: ${result.data.map((c: any) => `${c.name} (${c.id})`).join(', ')}`;
                }
                return `Found ${matches.length} customer(s): ${matches.map((c: any) => `${c.name} (ID: ${c.id}, Address: ${c.address || 'N/A'})`).join(', ')}`;
            });
        },
    }),
    geocodeAddress: tool({
        description: 'Convert a street address into latitude and longitude coordinates. Always use this before creating a job when the user provides an address instead of coordinates.',
        inputSchema: z.object({
            address: z.string().describe('The full street address to geocode, e.g. "100 W 50th St, Manhattan, NY"'),
        }),
        execute: async ({ address }) => {
            return safeExecute(async () => {
                const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
                if (!token) {
                    return 'Error: Mapbox access token is not configured.';
                }
                const encoded = encodeURIComponent(address);
                const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encoded}&access_token=${token}&limit=1`;
                const res = await fetch(url);
                if (!res.ok) {
                    return `Error: Geocoding request failed with status ${res.status}`;
                }
                const data = await res.json();
                const feature = data.features?.[0];
                if (!feature) {
                    return `No results found for address "${address}". Please try a more specific address.`;
                }
                const [lng, lat] = feature.geometry.coordinates;
                const placeName = feature.properties?.full_address || feature.properties?.name || address;
                return `Address: ${placeName}\nLatitude: ${lat}\nLongitude: ${lng}`;
            });
        },
    }),
    createJob: tool({
        description: 'Create a new job. IMPORTANT: Before calling this, you MUST: 1) Call lookupCustomer to get a valid customer_id UUID, and 2) Call geocodeAddress to get latitude/longitude from the address. Never ask the user for coordinates.',
        inputSchema: z.object({
            customer_id: z.string().uuid().describe('The UUID of the customer - get this from lookupCustomer first'),
            title: z.string().describe('Title of the job'),
            description: z.string().optional().describe('Description of the job'),
            status: z.enum(['requested', 'scheduled', 'in_progress', 'completed', 'cancelled']).describe('Status of the job'),
            scheduled_date: z.string().describe('Scheduled date in YYYY-MM-DD format'),
            scheduled_time: z.string().optional().describe('Scheduled time in HH:MM format'),
            estimated_duration_minutes: z.number().optional().describe('Estimated duration in minutes'),
            priority: z.enum(['low', 'normal', 'high', 'urgent']).describe('Priority level'),
            latitude: z.number().describe('Latitude from geocodeAddress'),
            longitude: z.number().describe('Longitude from geocodeAddress'),
            technician_id: z.string().uuid().optional().nullable().describe('UUID of the assigned technician'),
        }),
        execute: async (args) => {
            return safeExecute(async () => {
                const result = await createJob(args);
                if (!result.success) {
                    return `Error creating job: ${result.error}`;
                }
                return `Job created successfully! Job ID: ${result.data?.id}`;
            });
        },
    }),
    updateJob: tool({
        description: 'Update an existing job. Specify only the fields you want to change.',
        inputSchema: z.object({
            jobId: z.string().describe('The ID of the job to update'),
            title: z.string().optional().describe('New title'),
            description: z.string().optional().describe('New description'),
            status: z.enum(['requested', 'scheduled', 'in_progress', 'completed', 'cancelled']).optional().describe('New status'),
            priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().describe('New priority'),
            scheduled_date: z.string().optional().describe('New scheduled date in YYYY-MM-DD format'),
            scheduled_time: z.string().optional().describe('New scheduled time in HH:MM format'),
            notes: z.string().optional().describe('Notes to add'),
        }),
        execute: async ({ jobId, ...data }) => {
            return safeExecute(async () => {
                const result = await updateJob(jobId, data as any);
                if (!result.success) {
                    return `Error updating job: ${result.error}`;
                }
                return 'Job updated successfully!';
            });
        },
    }),
    getUpcomingJobs: tool({
        description: 'Get a list of upcoming jobs for the current user.',
        inputSchema: z.object({}),
        execute: async () => {
            return safeExecute(async () => {
                const result = await getUpcomingJobs();
                if (!result.success) {
                    return `Error: ${result.error}`;
                }
                if (!result.data || result.data.length === 0) {
                    return 'No upcoming jobs found.';
                }
                return `Found ${result.data.length} upcoming job(s):\n` + result.data.map((j: any) =>
                    `- ${j.title} | Customer: ${j.customer?.name || 'Unknown'} | ${j.scheduled_date} ${j.scheduled_time || ''} | Status: ${j.status} | Priority: ${j.priority || 'normal'}`
                ).join('\n');
            });
        },
    }),
} satisfies ToolSet;
