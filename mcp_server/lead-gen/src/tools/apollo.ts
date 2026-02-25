
import { searchPeople, enrichPerson } from "../services/apollo.js";

export const apolloTools = [
    {
        name: "apollo_search_people",
        description: "Search for people using Apollo.io. Use this to find prospects based on criteria like job title, keywords, and location. Returns a list of people with their details and LinkedIn URLs.",
        inputSchema: {
            type: "object",
            properties: {
                q_keywords: {
                    type: "string",
                    description: "Keywords to search for (e.g. 'marketing', 'sales', 'SaaS')"
                },
                person_titles: {
                    type: "array",
                    items: { type: "string" },
                    description: "Job titles to filter by (e.g. ['CEO', 'VP of Sales']). preferred over keywords for role filtering."
                },
                person_locations: {
                    type: "array",
                    items: { type: "string" },
                    description: "Locations to filter by (e.g. ['New York', 'Austin, TX'])"
                },
                organization_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "Apollo Organization IDs to filter by, if known."
                },
                page: { type: "number", description: "Page number for pagination (default 1)" },
                per_page: { type: "number", description: "Number of results per page (default 10, max 100)" }
            },
        },
    },
    {
        name: "apollo_enrich_person",
        description: "Get the full profile of a person from Apollo.io using their email or Apollo ID. Useful to get more details if the search result was incomplete.",
        inputSchema: {
            type: "object",
            properties: {
                email: { type: "string", description: "The person's email address" },
                id: { type: "string", description: "The person's Apollo ID" },
            },
        },
    },
];

export async function handleApolloTool(name: string, args: any) {
    if (name === "apollo_search_people") {
        const results = await searchPeople({
            qKeywords: args.q_keywords,
            personTitles: args.person_titles,
            personLocations: args.person_locations,
            organizationIds: args.organization_ids,
            page: args.page,
            per_page: args.per_page,
        });

        // Standardize output as requested: "clean list of names, titles, and LinkedIn URLs"
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        people: results.people.map(p => ({
                            id: p.id,
                            name: p.name || `${p.first_name} ${p.last_name}`,
                            title: p.title,
                            linkedin_url: p.linkedin_url,
                            organization: p.organization?.name,
                            // We include these to help the agent decide what to do next
                        })),
                        pagination: results.pagination
                    }, null, 2)
                }
            ]
        };
    }

    if (name === "apollo_enrich_person") {
        const person = await enrichPerson({ email: args.email, id: args.id });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(person, null, 2)
                }
            ]
        };
    }

    return null;
}
