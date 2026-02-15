import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
    typescript: true,
});

/**
 * Get the appropriate webhook secret based on environment
 * - Development: Use STRIPE_LOCAL_SECRET (from Stripe CLI)
 * - Production: Use STRIPE_WEBHOOK_SECRET (from Stripe Dashboard)
 */
export function getWebhookSecret(): string {
    const secret = process.env.NODE_ENV === 'development'
        ? process.env.STRIPE_LOCAL_SECRET
        : process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
        throw new Error(
            `Missing Stripe webhook secret for ${process.env.NODE_ENV} environment. ` +
            `Set ${process.env.NODE_ENV === 'development' ? 'STRIPE_LOCAL_SECRET' : 'STRIPE_WEBHOOK_SECRET'}`
        );
    }

    return secret;
}
