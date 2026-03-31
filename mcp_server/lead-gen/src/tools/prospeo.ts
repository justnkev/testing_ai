
import { findEmail, verifyEmail } from "../services/prospeo.js";

export const prospeoTools = [
    {
        name: "prospeo_find_email",
        description: "Find a verified email address for a person using Prospeo. Requires full name and company name (or domain). Use this after searching for prospects.",
        inputSchema: {
            type: "object",
            properties: {
                first_name: { type: "string", description: "Person's first name" },
                last_name: { type: "string", description: "Person's last name" },
                full_name: { type: "string", description: "Person's full name (alternative to first/last)" },
                company: { type: "string", description: "Company name (e.g. 'Google')" },
                domain: { type: "string", description: "Company domain (e.g. 'google.com'). Highly recommended for better accuracy." },
                linkedin_url: { type: "string", description: "LinkedIn Profile URL. If provided, overrides other fields." }
            },
            required: ["company"], // Company is required if using name, though domain is better.
        },
    },
    {
        name: "prospeo_verify_email",
        description: "Verify the deliverability of an email address using Prospeo. Returns a score and status (valid, invalid, risky).",
        inputSchema: {
            type: "object",
            properties: {
                email: { type: "string", description: "The email address to verify" },
            },
            required: ["email"],
        },
    },
];

export async function handleProspeoTool(name: string, args: any) {
    if (name === "prospeo_find_email") {
        // Logic: if domain is missing, try with company name. 
        // The service might need adjustment or we just pass what we have.
        // The user requirement: "If a lead from Apollo is missing a company domain, the Prospeo tool should attempt to find the email using the company name alone as a fallback."

        // We construct the params.
        const params: any = {};
        if (args.linkedin_url) params.url = args.linkedin_url;
        if (args.first_name) params.first_name = args.first_name;
        if (args.last_name) params.last_name = args.last_name;
        if (args.full_name) {
            // Simple split if first/last not provided
            const parts = args.full_name.split(' ');
            if (!params.first_name) params.first_name = parts[0];
            if (!params.last_name) params.last_name = parts.slice(1).join(' ');
        }
        if (args.domain) params.domain = args.domain;
        if (args.company) params.company = args.company;

        try {
            const result = await findEmail(params);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        } catch (e: any) {
            // Specialized error handling if needed, otherwise let it propagate or return error string
            return {
                isError: true,
                content: [{ type: "text", text: `Error finding email: ${e.message}` }]
            };
        }
    }

    if (name === "prospeo_verify_email") {
        try {
            const result = await verifyEmail(args.email);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        } catch (e: any) {
            return {
                isError: true,
                content: [{ type: "text", text: `Error verifying email: ${e.message}` }]
            };
        }
    }

    return null;
}
