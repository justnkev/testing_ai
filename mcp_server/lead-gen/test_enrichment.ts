
import dotenv from 'dotenv';
dotenv.config();

const { handleApolloTool } = await import('./dist/tools/apollo.js');

async function test() {
    console.log("Starting Enrichment Verification...");
    console.log("Using Apollo Key:", process.env.APOLLO_API_KEY ? process.env.APOLLO_API_KEY.substring(0, 4) + "..." : "Not Set");

    console.log("\n--- Testing Apollo Enrichment (Should work if credits exist) ---");
    try {
        // trying a generic email that likely exists in their DB
        const enrichRes = await handleApolloTool("apollo_enrich_person", {
            email: "ceo@tesla.com"
        });

        if (enrichRes && !enrichRes.isError) {
            console.log("✅ Apollo Enrichment Successful!");
            console.log("Result Preview:", enrichRes.content[0].text.substring(0, 200) + "...");
        } else {
            console.log("❌ Apollo Enrichment Failed");
            console.log(JSON.stringify(enrichRes, null, 2));
        }
    } catch (e: any) {
        console.error("❌ Apollo Enrichment Exception:", e.message);
    }
}

test();
