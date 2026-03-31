
import dotenv from 'dotenv';
dotenv.config();

// Dynamic imports to ensure env vars are loaded before modules
const { handleApolloTool } = await import('./dist/tools/apollo.js');
const { handleProspeoTool } = await import('./dist/tools/prospeo.js');

async function test() {
    console.log("Starting Manual Verification...");
    console.log("Using Apollo Key:", process.env.APOLLO_API_KEY ? process.env.APOLLO_API_KEY.substring(0, 4) + "..." : "Not Set");

    // Test 0: Auth Check
    console.log("\n--- Testing Auth Health ---");
    try {
        const healthRes = await fetch("https://api.apollo.io/v1/auth/health", {
            headers: { "X-Api-Key": process.env.APOLLO_API_KEY || "" }
        });
        console.log("Auth Health Status:", healthRes.status, await healthRes.text());
    } catch (e: any) { console.error("Auth Check Failed", e.message); }

    // Test 1: Apollo Search
    console.log("\n--- Testing Apollo Search ---");
    try {
        const searchRes = await handleApolloTool("apollo_search_people", {
            q_keywords: "Software Engineer",
            per_page: 1
        });
        if (searchRes && !searchRes.isError) {
            console.log("✅ Apollo Search Successful");
            console.log("Result Preview:", searchRes.content[0].text.substring(0, 200) + "...");
        } else {
            console.error("❌ Apollo Search Failed or Returned Error:", JSON.stringify(searchRes, null, 2));
        }
    } catch (e: any) {
        console.error("❌ Apollo Search Exception:", e.message);
    }
}

test();
