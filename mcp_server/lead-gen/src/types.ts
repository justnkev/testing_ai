export interface ApolloPerson {
    id: string;
    first_name: string;
    last_name: string;
    name: string;
    linkedin_url?: string;
    title?: string;
    email_status?: string;
    photo_url?: string;
    twitter_url?: string;
    github_url?: string;
    facebook_url?: string;
    ext?: string;
    organization?: {
        name: string;
        website_url: string;
        logo_url: string;
    };
    email?: string;
}

export interface ApolloSearchResponse {
    people: ApolloPerson[];
    pagination: {
        page: number;
        per_page: number;
        total_entries: number;
        total_pages: number;
    };
}

export interface ProspeoEmailFinderResponse {
    email?: string;
    score?: number;
    status?: string;
    domain_status?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    company_name?: string;
    domain?: string;
    description?: string; // For verification
    is_catch_all?: boolean;
}
