import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CreditManager } from '@/utils/creditManager';
import { TRIPAY_CONFIG } from '@/app/config/plans';
import { TripayWebhookPayload } from '@/types/credits';
import { createHmac } from 'crypto';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verify Tripay webhook signature
 */
function verifyWebhookSignature(payload: TripayWebhookPayload): boolean {
  try {
    // Create the JSON payload string (same as Tripay sends)
    const jsonPayload = JSON.stringify(payload);

    // Generate expected signature
    const expectedSignature = createHmac('sha256', TRIPAY_CONFIG.PRIVATE_KEY)
      .update(jsonPayload)
      .digest('hex');

    // Compare with received signature
    return payload.signature === expectedSignature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Handle Tripay payment webhook
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();
    let payload: TripayWebhookPayload;

    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      console.error('Invalid JSON payload:', error);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(payload)) {
      console.error('Invalid webhook signature for reference:', payload.reference);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    console.log('Processing Tripay webhook:', {
      reference: payload.reference,
      status: payload.status,
      amount: payload.amount,
    });

    // Find the payment in our database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('reference', payload.reference)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found for reference:', payload.reference);
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Check if payment is already processed to prevent duplicates
    if (payment.status === 'paid') {
      console.log('Payment already processed:', payload.reference);
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // Map Tripay status to our status
    let newStatus: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
    switch (payload.status) {
      case 'PAID':
        newStatus = 'paid';
        break;
      case 'REFUND':
        newStatus = 'refunded';
        break;
      case 'EXPIRED':
        newStatus = 'expired';
        break;
      case 'FAILED':
        newStatus = 'failed';
        break;
      default:
        console.warn('Unknown Tripay status:', payload.status);
        newStatus = 'failed';
    }

    // Update payment status
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: newStatus,
        tripay_data: {
          ...payment.tripay_data,
          webhook_payload: payload,
          processed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update payment status' },
        { status: 500 }
      );
    }

    // If payment is successful, add credits to user account
    if (newStatus === 'paid') {
      const tripayData = payment.tripay_data;
      const creditsToAdd = (tripayData.credits || 0) + (tripayData.bonus || 0);

      if (creditsToAdd > 0) {
        console.log('Adding credits to user:', {
          userId: payment.user_id,
          credits: creditsToAdd,
          reference: payload.reference,
        });

        // Add credits to user account
        const { success, error: creditError, transaction } = await CreditManager.addCredits(
          payment.user_id,
          creditsToAdd,
          `Credit purchase - ${tripayData.package_id || 'package'}`,
          payload.reference,
          'purchase'
        );

        if (!success) {
          console.error('Error adding credits:', creditError);

          // Don't fail the webhook, but log the error for manual intervention
          // In production, you might want to set up alerts for this
          return NextResponse.json({
            success: true,
            message: 'Payment processed but credit addition failed',
            warning: 'Manual intervention required',
          });
        }

        console.log('Credits added successfully:', {
          userId: payment.user_id,
          transactionId: transaction?.id,
          credits: creditsToAdd,
        });

        // Create usage log for the purchase
        await CreditManager.logUsage(
          payment.user_id,
          'system',
          0, // No credits used for purchase
          {
            type: 'credit_purchase',
            package_id: tripayData.package_id,
            credits_purchased: tripayData.credits,
            bonus_credits: tripayData.bonus,
            payment_reference: payload.reference,
            payment_method: payload.payment_method,
            amount: payload.amount,
          }
        );
      }
    }

    // Log successful webhook processing
    console.log('Tripay webhook processed successfully:', {
      reference: payload.reference,
      status: newStatus,
      userId: payment.user_id,
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
    });

  } catch (error) {
    console.error('Error processing Tripay webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle webhook verification (GET request for testing)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
      return NextResponse.json(
        { error: 'Reference parameter is required' },
        { status: 400 }
      );
    }

    // Find the payment
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('reference', reference)
      .single();

    if (error || !payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        reference: payment.reference,
        status: payment.status,
        amount: payment.amount,
        userId: payment.user_id,
        createdAt: payment.created_at,
        tripayData: payment.tripay_data,
      },
    });

  } catch (error) {
    console.error('Error verifying webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function PUT() {
  return NextResponse.json({
    success: true,
    message: 'Tripay webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}