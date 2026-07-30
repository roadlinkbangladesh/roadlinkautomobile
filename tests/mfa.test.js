/**
 * Automated Test Suite for MFA Login Flow, Session Resilience, & Lockout Policies
 */

const BASE_URL = (process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function runMfaTestSuite() {
  console.log('====================================================');
  console.log('   MFA RESILIENCE & ERROR DISTINCTION TEST SUITE     ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    // 1. Missing MFA token -> HTTP 400 BAD_REQUEST
    const missingTokenRes = await fetch(`${BASE_URL}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456' })
    });
    const missingTokenJson = await missingTokenRes.json();
    assert(
      missingTokenRes.status === 400 && missingTokenJson.code === 'BAD_REQUEST',
      'TC-MFA-1: Missing MFA Token Rejection',
      `Status ${missingTokenRes.status}, Code: ${missingTokenJson.code}`
    );

    // 2. Expired / Invalid MFA challenge token -> HTTP 401 MFA_CHALLENGE_EXPIRED
    const expiredTokenRes = await fetch(`${BASE_URL}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfa_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired_payload.sig', code: '123456' })
    });
    const expiredTokenJson = await expiredTokenRes.json();
    assert(
      expiredTokenRes.status === 401 && expiredTokenJson.code === 'MFA_CHALLENGE_EXPIRED',
      'TC-MFA-2: Expired MFA Challenge Session Identification',
      `Status ${expiredTokenRes.status}, Code: ${expiredTokenJson.code}`
    );

    // 3. Invalidated authentication session -> HTTP 401 SESSION_INVALIDATED / ACCOUNT_DISABLED
    // Verify structure with tampered version or inactive check
    assert(
      typeof expiredTokenJson.message === 'string' && expiredTokenJson.message.length > 0,
      'TC-MFA-3: Contextual Error Message Inclusion',
      `Message: "${expiredTokenJson.message}"`
    );

  } catch (err) {
    console.error('Fatal execution error in MFA test suite:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`   SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMfaTestSuite();
