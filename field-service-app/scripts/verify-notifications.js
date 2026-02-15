const path = require('path');
const fs = require('fs');

// Simple .env parser since we can't assume dotenv is installed/configured for this script
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '../.env.local');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars = {};
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                // Remove quotes if present
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                process.env[key] = value;
            }
        });
        console.log('✅ Loaded .env.local');
    } catch (e) {
        console.error('❌ Failed to load .env.local:', e.message);
    }
}

loadEnv();

// Helper to check env vars
function check(key) {
    const val = process.env[key];
    if (val) {
        console.log(`✅ ${key} is set (${val.slice(0, 4)}...)`);
        return true;
    } else {
        console.log(`❌ ${key} is MISSING`);
        return false;
    }
}

console.log('\n--- Checking Environment Configuration ---');
const hasResend = check('RESEND_API_KEY');
const hasTwilioSid = check('TWILIO_ACCOUNT_SID');
const hasTwilioToken = check('TWILIO_AUTH_TOKEN');
const hasTwilioPhone = check('TWILIO_PHONE_NUMBER');

console.log('\n--- Testing Resend (Email) ---');
if (hasResend) {
    try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        // Sandbox only allows sending to verified email (likely the user's own email)
        const recipient = 'justnkev@gmail.com';

        console.log(`Attempting to send email to ${recipient}...`);

        resend.emails.send({
            from: 'Field Service <onboarding@resend.dev>',
            to: [recipient],
            subject: 'Test Notification Verification',
            html: '<p>This is a test to verify API keys are working.</p>'
        }).then(data => {
            if (data.error) {
                console.error('❌ Resend API Error:', data.error);
            } else {
                console.log('✅ Email sent successfully!', data);
            }
        }).catch(err => {
            console.error('❌ Email Request Execution Error:', err);
        });
    } catch (e) {
        console.error('❌ Failed to execute Resend test (module issue?):', e.message);
    }
} else {
    console.log('Skipping Email test due to missing keys');
}

console.log('\n--- Testing Twilio (SMS) ---');
if (hasTwilioSid && hasTwilioToken && hasTwilioPhone) {
    try {
        const client = require('twilio')(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
        const recipient = '+12033215028';

        console.log(`Attempting to send SMS to ${recipient}...`);

        client.messages.create({
            body: 'Test Notification Verification',
            from: process.env.TWILIO_PHONE_NUMBER,
            to: recipient
        }).then(message => {
            console.log('✅ SMS sent successfully! SID:', message.sid);
        }).catch(err => {
            console.error('❌ Twilio API Error:', err.message);
            if (err.code === 21608) {
                console.log('💡 Note: Verified numbers only in trial mode?');
            }
        });
    } catch (e) {
        console.error('❌ Failed to execute Twilio test (module issue?):', e.message);
    }
} else {
    console.log('Skipping SMS test due to missing keys');
}
