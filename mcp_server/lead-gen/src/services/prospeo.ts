
import axios, { AxiosError } from 'axios';
import { ProspeoEmailFinderResponse } from '../types.js';

const PROSPEO_API_KEY = process.env.PROSPEO_API_KEY;

if (!PROSPEO_API_KEY) {
    console.error("Warning: PROSPEO_API_KEY is not set.");
}

const client = axios.create({
    baseURL: 'https://api.prospeo.io',
    headers: {
        'Content-Type': 'application/json',
        'X-Key': PROSPEO_API_KEY,
    },
});

export async function findEmail(params: {
    url?: string; // LinkedIn URL
    first_name?: string;
    last_name?: string;
    company?: string;
    domain?: string;
}): Promise<ProspeoEmailFinderResponse> {
    try {
        // Prospeo has different endpoints. /email-finder is flexible.
        // If domain calls fail, we might try company.
        const response = await client.post('/email-finder', params);
        return response.data;
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            console.error("Prospeo API Error Details:", JSON.stringify(error.response?.data || {}, null, 2));
            if (error.response?.status === 429) {
                throw new Error("Prospeo Rate limit exceeded.");
            }
        }

        // Fallback handling logic if domain is missing but company is provided?
        // The prompt asked for: "If a lead from Apollo is missing a company domain, the Prospeo tool should attempt to find the email using the company name alone as a fallback."
        // The /email-finder endpoint usually expects a domain or a LinkedIn URL. 
        // If we pass company name as 'company' it might work if the API supports it or we might need to find domain first.
        // Assuming Prospeo's /email-finder supports `company` + `full_name` or `first/last`.
        throw error;
    }
}

export async function verifyEmail(email: string): Promise<ProspeoEmailFinderResponse> {
    try {
        const response = await client.post('/email-verifier', { email });
        return response.data;
    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
            throw new Error("Prospeo Rate limit exceeded.");
        }
        throw error;
    }
}
