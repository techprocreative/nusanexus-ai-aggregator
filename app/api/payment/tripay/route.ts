import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { CreditManager } from '@/utils/creditManager';
import { TRIPAY_CONFIG, CREDIT_PACKAGES } from '@/app/config/plans';
import { TripayPaymentRequest, TripayPaymentResponse } from '@/types/credits';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Crypto library for signature verification
import { createHmac } from 'crypto';

/**
 * Generate Tripay signature
 */
function generateSignature(payload: string): string {
  return createHmac('sha256', TRIPAY_CONFIG.PRIVATE_KEY)
    .update(payload)
    .digest('hex');
}

/**
 * Create Tripay payment session
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { packageId, paymentMethod } = body;

    if (!packageId || !paymentMethod) {
      return NextResponse.json(
        { error: 'Package ID and payment method are required' },
        { status: 400 }
      );
    }

    // Get credit package details
    const creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
    if (!creditPackage) {
      return NextResponse.json(
        { error: 'Invalid credit package' },
        { status: 400 }
      );
    }

    // Get user details
    const { data: userData, error: userError } = await supabase
      .from('user_credits')
      .select(`
        user_id,
        plans (name)
      `)
      .eq('user_id', userId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user data:', userError);
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    // Create payment record in database
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        reference: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        amount: creditPackage.priceInCents,
        method: paymentMethod,
        status: 'pending',
        tripay_data: {
          package_id: packageId,
          credits: creditPackage.credits,
          bonus: creditPackage.bonus,
        },
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error('Error creating payment record:', paymentError);
      return NextResponse.json(
        { error: 'Failed to create payment record' },
        { status: 500 }
      );
    }

    // Prepare Tripay payment request
    const tripayPayload: TripayPaymentRequest = {
      method: paymentMethod,
      amount: creditPackage.priceInCents,
      customer_name: `User ${userId.substr(0, 8)}`, // In production, get from user profile
      customer_email: `user-${userId.substr(0, 8)}@example.com`, // In production, get from user profile
      customer_phone: '08123456789', // In production, get from user profile
      order_items: [
        {
          sku: packageId,
          name: `${creditPackage.name} (${creditPackage.credits + creditPackage.bonus} credits)`,
          price: creditPackage.priceInCents,
          quantity: 1,
        },
      ],
      callback_url: TRIPAY_CONFIG.CALLBACK_URL,
      return_url: `${TRIPAY_CONFIG.RETURN_URL}?payment_id=${payment.id}`,
      expired_time: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    };

    // Make request to Tripay API
    const tripayResponse = await fetch('https://tripay.co.id/api-sandbox/transaction/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TRIPAY_CONFIG.API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tripayPayload),
    });

    if (!tripayResponse.ok) {
      console.error('Tripay API error:', await tripayResponse.text());

      // Update payment status to failed
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id);

      return NextResponse.json(
        { error: 'Payment gateway error' },
        { status: 500 }
      );
    }

    const tripayData: TripayPaymentResponse = await tripayResponse.json();

    if (!tripayData.success || !tripayData.data) {
      console.error('Tripay error response:', tripayData);

      // Update payment status to failed
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id);

      return NextResponse.json(
        { error: tripayData.message || 'Payment processing failed' },
        { status: 400 }
      );
    }

    // Update payment record with Tripay data
    await supabase
      .from('payments')
      .update({
        reference: tripayData.data.reference,
        tripay_data: {
          ...payment.tripay_data,
          tripay_response: tripayData.data,
        },
      })
      .eq('id', payment.id);

    return NextResponse.json({
      success: true,
      data: {
        paymentId: payment.id,
        reference: tripayData.data.reference,
        checkoutUrl: tripayData.data.checkout_url,
        amount: creditPackage.priceInCents,
        credits: creditPackage.credits,
        bonus: creditPackage.bonus,
        totalCredits: creditPackage.credits + creditPackage.bonus,
        expiresAt: new Date(tripayData.data.expired_time * 1000).toISOString(),
        paymentMethod: tripayData.data.method,
        payUrl: tripayData.data.pay_url,
        qrUrl: tripayData.data.qr_url,
        payCode: tripayData.data.pay_code,
      },
    });

  } catch (error) {
    console.error('Error creating payment session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get payment status
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('payment_id');
    const reference = searchParams.get('reference');

    if (!paymentId && !reference) {
      return NextResponse.json(
        { error: 'Payment ID or reference is required' },
        { status: 400 }
      );
    }

    // Query payment from database
    let query = supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId);

    if (paymentId) {
      query = query.eq('id', paymentId);
    } else {
      query = query.eq('reference', reference);
    }

    const { data: payment, error } = await query.single();

    if (error || !payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // If payment is still pending, check with Tripay
    if (payment.status === 'pending' && payment.reference) {
      try {
        const tripayResponse = await fetch(`https://tripay.co.id/api-sandbox/transaction/detail?reference=${payment.reference}`, {
          headers: {
            'Authorization': `Bearer ${TRIPAY_CONFIG.API_KEY}`,
          },
        });

        if (tripayResponse.ok) {
          const tripayData = await tripayResponse.json();

          if (tripayData.success && tripayData.data) {
            // Update payment status
            const newStatus = mapTripayStatus(tripayData.data.status);
            await supabase
              .from('payments')
              .update({
                status: newStatus,
                tripay_data: {
                  ...payment.tripay_data,
                  tripay_status: tripayData.data,
                },
              })
              .eq('id', payment.id);

            payment.status = newStatus;
          }
        }
      } catch (tripayError) {
        console.error('Error checking Tripay status:', tripayError);
        // Don't fail the request, just return cached status
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: payment.id,
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
        method: payment.method,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
        tripayData: payment.tripay_data,
      },
    });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Map Tripay status to our status
 */
function mapTripayStatus(tripayStatus: string): 'pending' | 'paid' | 'failed' | 'expired' | 'refunded' {
  switch (tripayStatus.toUpperCase()) {
    case 'UNPAID':
      return 'pending';
    case 'PAID':
      return 'paid';
    case 'REFUND':
      return 'refunded';
    case 'EXPIRED':
      return 'expired';
    case 'FAILED':
    default:
      return 'failed';
  }
}

/**
 * Get available payment methods
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch available payment methods from Tripay
    const tripayResponse = await fetch('https://tripay.co.id/api-sandbox/payment-channel', {
      headers: {
        'Authorization': `Bearer ${TRIPAY_CONFIG.API_KEY}`,
      },
    });

    if (!tripayResponse.ok) {
      console.error('Error fetching payment methods:', await tripayResponse.text());
      return NextResponse.json(
        { error: 'Failed to fetch payment methods' },
        { status: 500 }
      );
    }

    const tripayData = await tripayResponse.json();

    if (!tripayData.success) {
      return NextResponse.json(
        { error: tripayData.message || 'Failed to fetch payment methods' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: tripayData.data,
    });

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}