-- Migration: Add credit system and Tripay payment integration
-- This migration adds tables for credit-based billing system compatible with Tripay
-- and replaces the Stripe-centric approach with credit management

-- Create plan types enum
CREATE TYPE plan_tier AS ENUM ('free', 'professional', 'enterprise');

-- Create transaction types enum
CREATE TYPE transaction_type AS ENUM ('purchase', 'usage', 'refund', 'bonus');

-- Create payment status enum
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'expired', 'refunded');

-- Plans table for subscription tiers
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name plan_tier NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    price_in_cents INTEGER NOT NULL, -- Price in cents (IDR)
    credits INTEGER NOT NULL, -- Number of credits included
    features JSONB NOT NULL DEFAULT '{}', -- Feature flags
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User credits table
CREATE TABLE user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE, -- References Clerk user ID
    plan_id UUID REFERENCES plans(id),
    balance INTEGER NOT NULL DEFAULT 0, -- Current credit balance
    total_purchased INTEGER NOT NULL DEFAULT 0, -- Total credits ever purchased
    total_used INTEGER NOT NULL DEFAULT 0, -- Total credits ever used
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table for all credit movements
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- References Clerk user ID
    type transaction_type NOT NULL,
    amount INTEGER NOT NULL, -- Positive for credits added, negative for credits used
    balance_after INTEGER NOT NULL, -- Balance after this transaction
    description TEXT,
    reference_id TEXT, -- Tripay payment reference or API request ID
    metadata JSONB DEFAULT '{}', -- Additional data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table for Tripay integration
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- References Clerk user ID
    reference TEXT NOT NULL UNIQUE, -- Tripay payment reference
    amount INTEGER NOT NULL, -- Amount in cents
    method TEXT, -- Payment method (e.g., 'bank_transfer', 'ewallet')
    status payment_status DEFAULT 'pending',
    tripay_data JSONB DEFAULT '{}', -- Store Tripay response data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI models configuration
CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL, -- 'openrouter' or 'together'
    model_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    cost_per_credit DECIMAL(10,6) NOT NULL, -- Base cost from provider
    markup_multiplier DECIMAL(4,2) DEFAULT 1.5, -- Our markup (1.5 = 50% markup)
    is_free BOOLEAN DEFAULT false, -- Available for free tier
    is_active BOOLEAN DEFAULT true,
    model_type TEXT NOT NULL, -- 'chat', 'image', 'video'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking for analytics
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    model_id UUID REFERENCES ai_models(id),
    credits_used INTEGER NOT NULL,
    request_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_reference ON payments(reference);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_ai_models_provider ON ai_models(provider);
CREATE INDEX idx_ai_models_model_type ON ai_models(model_type);

-- RLS Policies
-- Plans: Everyone can read active plans
CREATE POLICY "Plans are viewable by everyone" ON plans
    FOR SELECT USING (is_active = true);

-- User credits: Users can only access their own credits
CREATE POLICY "Users can view own credits" ON user_credits
    FOR SELECT USING (auth.uid()::text = user_id);

-- Transactions: Users can only view their own transactions
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid()::text = user_id);

-- Payments: Users can only view their own payments
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (auth.uid()::text = user_id);

-- AI models: Everyone can read active models
CREATE POLICY "Active models are viewable by everyone" ON ai_models
    FOR SELECT USING (is_active = true);

-- Usage logs: Users can only view their own usage
CREATE POLICY "Users can view own usage logs" ON usage_logs
    FOR SELECT USING (auth.uid()::text = user_id);

-- Functions for credit management
CREATE OR REPLACE FUNCTION deduct_credits(
    p_user_id TEXT,
    p_amount INTEGER,
    p_description TEXT DEFAULT 'Credit usage',
    p_reference_id TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    current_balance INTEGER;
    new_balance INTEGER;
BEGIN
    -- Get current balance and lock row
    SELECT balance INTO current_balance
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Check if user exists
    IF current_balance IS NULL THEN
        RAISE EXCEPTION 'User credit account not found';
    END IF;

    -- Check sufficient balance
    IF current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    -- Calculate new balance
    new_balance := current_balance - p_amount;

    -- Update balance
    UPDATE user_credits
    SET balance = new_balance,
        total_used = total_used + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Create transaction record
    INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id)
    VALUES (p_user_id, 'usage', -p_amount, new_balance, p_description, p_reference_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_credits(
    p_user_id TEXT,
    p_amount INTEGER,
    p_description TEXT DEFAULT 'Credit purchase',
    p_reference_id TEXT DEFAULT NULL,
    p_type transaction_type DEFAULT 'purchase'
) RETURNS BOOLEAN AS $$
DECLARE
    current_balance INTEGER;
    new_balance INTEGER;
BEGIN
    -- Get current balance and lock row
    SELECT balance INTO current_balance
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Create user credit account if it doesn't exist
    IF current_balance IS NULL THEN
        INSERT INTO user_credits (user_id, balance, total_purchased)
        VALUES (p_user_id, p_amount, p_amount);
        new_balance := p_amount;
    ELSE
        -- Calculate new balance
        new_balance := current_balance + p_amount;

        -- Update balance
        UPDATE user_credits
        SET balance = new_balance,
            total_purchased = CASE WHEN p_type = 'purchase' THEN total_purchased + p_amount ELSE total_purchased END,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;

    -- Create transaction record
    INSERT INTO transactions (user_id, type, amount, balance_after, description, reference_id)
    VALUES (p_user_id, p_type, p_amount, new_balance, p_description, p_reference_id);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_balance(p_user_id TEXT) RETURNS INTEGER AS $$
DECLARE
    balance INTEGER;
BEGIN
    SELECT balance INTO balance
    FROM user_credits
    WHERE user_id = p_user_id;

    RETURN COALESCE(balance, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to create user credit account when user signs up
CREATE OR REPLACE FUNCTION create_user_credit_account() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_credits (user_id, plan_id, balance)
    VALUES (NEW.id,
            (SELECT id FROM plans WHERE name = 'free' LIMIT 1),
            (SELECT credits FROM plans WHERE name = 'free' LIMIT 1))
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated trigger function to get user ID from Clerk JWT
CREATE OR REPLACE FUNCTION get_user_from_clerk_jwt() RETURNS TRIGGER AS $$
BEGIN
    -- This will be called by RLS to get the user ID from Clerk JWT
    -- The actual implementation will depend on how Clerk JWT is structured
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Seed data for plans
INSERT INTO plans (name, display_name, description, price_in_cents, credits, features) VALUES
('free', 'Free', 'Basic access with limited credits', 0, 100,
 '{"chat": true, "compare": false, "image_generation": false, "video_generation": false, "max_models": 5}'),
('professional', 'Professional', 'Enhanced access with more credits and features', 150000, 1000,
 '{"chat": true, "compare": true, "image_generation": true, "video_generation": false, "max_models": 20}'),
('enterprise', 'Enterprise', 'Full access with unlimited features', 500000, 5000,
 '{"chat": true, "compare": true, "image_generation": true, "video_generation": true, "max_models": 999}');

-- Seed data for AI models (OpenRouter)
INSERT INTO ai_models (provider, model_name, display_name, cost_per_credit, is_free, model_type) VALUES
('openrouter', 'meta-llama/llama-3.2-3b-instruct:free', 'Llama 3.2 3B (Free)', 0.0001, true, 'chat'),
('openrouter', 'meta-llama/llama-3.2-1b-instruct:free', 'Llama 3.2 1B (Free)', 0.00005, true, 'chat'),
('openrouter', 'microsoft/phi-3-mini-128k-instruct:free', 'Phi-3 Mini (Free)', 0.0001, true, 'chat'),
('openrouter', 'qwen/qwen-2.5-7b-instruct:free', 'Qwen 2.5 7B (Free)', 0.0001, true, 'chat'),
('openrouter', 'meta-llama/llama-3.1-70b-instruct', 'Llama 3.1 70B', 0.0059, false, 'chat'),
('openrouter', 'anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 0.015, false, 'chat'),
('openrouter', 'openai/gpt-4o', 'GPT-4o', 0.005, false, 'chat'),
('openrouter', 'openai/gpt-4o-mini', 'GPT-4o Mini', 0.00015, false, 'chat'),
('openrouter', 'google/gemini-pro-1.5', 'Gemini Pro 1.5', 0.007, false, 'chat');

-- Seed data for AI models (Together AI - Image Generation)
INSERT INTO ai_models (provider, model_name, display_name, cost_per_credit, is_free, model_type) VALUES
('together', 'black-forest-labs/FLUX.1-schnell', 'FLUX.1 Schnell', 0.004, false, 'image'),
('together', 'black-forest-labs/FLUX.1-dev', 'FLUX.1 Dev', 0.055, false, 'image'),
('together', 'stabilityai/stable-diffusion-xl-base-1.0', 'SDXL Base 1.0', 0.06, false, 'image'),
('together', 'stabilityai/stable-diffusion-2-1', 'Stable Diffusion 2.1', 0.025, false, 'image');

-- Seed data for AI models (Together AI - Video Generation)
INSERT INTO ai_models (provider, model_name, display_name, cost_per_credit, is_free, model_type) VALUES
('together', 'stabilityai/stable-video-diffusion', 'Stable Video Diffusion', 0.3, false, 'video'),
('together', 'genmo/mochi-1-preview', 'Mochi 1 Preview', 0.25, false, 'video');

-- Grant necessary permissions
GRANT ALL ON plans TO authenticated;
GRANT ALL ON user_credits TO authenticated;
GRANT ALL ON transactions TO authenticated;
GRANT ALL ON payments TO authenticated;
GRANT SELECT ON ai_models TO authenticated;
GRANT ALL ON usage_logs TO authenticated;

GRANT SELECT ON plans TO anon;
GRANT SELECT ON ai_models TO anon;

GRANT EXECUTE ON FUNCTION deduct_credits TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_balance TO authenticated;