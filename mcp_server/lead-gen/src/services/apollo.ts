
import axios, { AxiosError } from 'axios';
import { ApolloPerson, ApolloSearchResponse } from '../types.js';

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

if (!APOLLO_API_KEY) {
    console.error("Warning: APOLLO_API_KEY is not set.");
}

const client = axios.create({
    baseURL: 'https://api.apollo.io/v1',
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY,
    },
});

export async function searchPeople(params: {
    qKeywords?: string;
    personTitles?: string[];
    organizationIds?: string[];
    personLocations?: string[];
    page?: number;
    per_page?: number;
}): Promise<ApolloSearchResponse> {
    try {
        const payload = {
            q_keywords: params.qKeywords,
            person_titles: params.personTitles,
            organization_ids: params.organizationIds,
            person_locations: params.personLocations,
            page: params.page,
            per_page: params.per_page
        };
        const response = await client.post('/mixed_people/api_search', payload);
        return response.data;
    } catch (error: any) {
        handleApolloError(error);
        throw error;
    }
}

export async function enrichPerson(params: {
    email?: string;
    id?: string;
}): Promise<ApolloPerson> {
    try {
        // Note: Apollo's enrichment endpoint might differ, using people/match is common for email
        // Or if we have ID, there is a specific endpoint.
        // For simplicity, let's use the people/match endpoint which is versatile.
        const response = await client.post('/people/match', params);
        return response.data.person;
    } catch (error: any) {
        handleApolloError(error);
        throw error;
    }
}

function handleApolloError(error: any) {
    if (axios.isAxiosError(error)) {
        console.error("Apollo API Error Details:", JSON.stringify(error.response?.data || {}, null, 2));
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            if (axiosError.response.status === 429) {
                console.error("Apollo API Rate Limit Exceeded.");
                throw new Error("Rate limit exceeded. Please try again later.");
            }
            if (axiosError.response.status === 402 || (axiosError.response.data as any)?.error_message?.includes("credits")) {
                console.error("Apollo API Insufficient Credits.");
                // We might return a specific error or just log it.
            }
        }
    }
}
