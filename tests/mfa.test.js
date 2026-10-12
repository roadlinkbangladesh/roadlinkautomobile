/**
 * Automated Test Suite for MFA Login Flow, Session Resilience, & Lockout Policies
 */

import { generateTotpCode } from "../worker/src/utils/mfa.js";

let rawUrl = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3000';
if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = 'https://' + rawUrl;
}
const BASE_URL = rawUrl.replace(/\/$/, '');

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

    // 3. Invalidated authentication session contextual error message
    assert(
      typeof expiredTokenJson.message === 'string' && expiredTokenJson.message.length > 0,
      'TC-MFA-3: Contextual Error Message Inclusion',
      `Message: "${expiredTokenJson.message}"`
    );

    // 4. Algorithm 'none' Attack Rejection
    const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const nonePayload = Buffer.from(JSON.stringify({ id: 1, username: "admin", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    const noneToken = `${noneHeader}.${nonePayload}.`;
    const algNoneRes = await fetch(`${BASE_URL}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${noneToken}` }
    });
    assert(
      algNoneRes.status === 401,
      'TC-MFA-4: Algorithm "none" JWT Rejection',
      `Status: ${algNoneRes.status}`
    );

    // 5. Algorithm Mismatch Attack Rejection (e.g. RS256 header with HMAC signature)
    const rsHeader = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const rsToken = `${rsHeader}.${nonePayload}.dGVzdHNpZ25hdHVyZQ`;
    const algMismatchRes = await fetch(`${BASE_URL}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${rsToken}` }
    });
    assert(
      algMismatchRes.status === 401,
      'TC-MFA-5: Mismatched Algorithm Header Rejection',
      `Status: ${algMismatchRes.status}`
    );

    // 6. CORS Policy: Disallow Untrusted Origins
    const corsRes = await fetch(`${BASE_URL}/api/v1/public/settings`, {
      headers: { Origin: 'https://evil-hacker-domain.com' }
    });
    const allowOriginHeader = corsRes.headers.get("access-control-allow-origin");
    assert(
      !allowOriginHeader || allowOriginHeader !== 'https://evil-hacker-domain.com',
      'TC-MFA-6: Restrictive CORS Origin Protection',
      `Access-Control-Allow-Origin: ${allowOriginHeader || "none"}`
    );

    // 7. Full MFA Lifecycle: Setup, Enable, Session Invalidation, and Recovery Code Use
    // 7.1 Login as admin to get initial token
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123456' })
    });
    const loginJson = await loginRes.json();
    const adminToken = loginJson?.data?.token;
    assert(Boolean(adminToken), 'TC-MFA-7: Admin Login Prior to MFA Enrollment');

    // 7.2 Initiate MFA Setup
    const setupRes = await fetch(`${BASE_URL}/api/v1/auth/mfa/setup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const setupJson = await setupRes.json();
    const setupSecret = setupJson?.data?.secret;
    const setupToken = setupJson?.data?.setup_token;
    assert(
      setupRes.status === 200 && Boolean(setupSecret) && Boolean(setupToken),
      'TC-MFA-8: MFA Setup Returns Secret and Setup Token',
      `Secret length: ${setupSecret?.length || 0}`
    );

    // 7.3 Enable MFA with Valid TOTP Code
    const validOtp = await generateTotpCode(setupSecret);
    const enableRes = await fetch(`${BASE_URL}/api/v1/auth/mfa/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        code: validOtp,
        setup_token: setupToken
      })
    });
    const enableJson = await enableRes.json();
    const recoveryCodes = enableJson?.data?.recovery_codes || [];
    const freshTokenAfterMfa = enableJson?.data?.token;
    assert(
      enableRes.status === 200 && recoveryCodes.length === 8,
      'TC-MFA-9: MFA Enablement Returns 8 Single-Use Recovery Codes',
      `Codes count: ${recoveryCodes.length}`
    );

    // 7.4 Verify Old Session Token is Invalidated (token_version bumped)
    const oldSessionRes = await fetch(`${BASE_URL}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      oldSessionRes.status === 401,
      'TC-MFA-10: Pre-MFA Session Invalidation on Enablement',
      `Status: ${oldSessionRes.status}`
    );

    // 7.5 Sign in again: Must return MFA challenge
    const secondLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123456' })
    });
    const secondLoginJson = await secondLoginRes.json();
    const mfaPendingToken = secondLoginJson?.data?.mfa_token;
    assert(
      secondLoginJson?.data?.mfa_required === true && Boolean(mfaPendingToken),
      'TC-MFA-11: Login Flow Enforces MFA Challenge',
      `mfa_required: ${secondLoginJson?.data?.mfa_required}`
    );

    // 7.6 Single-Use Recovery Code Verification: First use succeeds
    const firstRecoveryCode = recoveryCodes[0];
    const recoveryVerifyRes1 = await fetch(`${BASE_URL}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfa_token: mfaPendingToken,
        recovery_code: firstRecoveryCode
      })
    });
    const recoveryVerifyJson1 = await recoveryVerifyRes1.json();
    const tokenFromRecovery = recoveryVerifyJson1?.data?.token;
    assert(
      recoveryVerifyRes1.status === 200 && Boolean(tokenFromRecovery),
      'TC-MFA-12: Recovery Code Authentication Success',
      `Token issued: ${Boolean(tokenFromRecovery)}`
    );

    // 7.7 Re-attempt login to verify the consumed recovery code CANNOT be reused
    const thirdLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123456' })
    });
    const thirdLoginJson = await thirdLoginRes.json();
    const mfaPendingToken2 = thirdLoginJson?.data?.mfa_token;

    const recoveryVerifyRes2 = await fetch(`${BASE_URL}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfa_token: mfaPendingToken2,
        recovery_code: firstRecoveryCode
      })
    });
    assert(
      recoveryVerifyRes2.status === 400,
      'TC-MFA-13: Replay Prevention on Consumed Recovery Code',
      `Status: ${recoveryVerifyRes2.status}`
    );

    // 7.8 Disable MFA to restore baseline state
    const disableRes = await fetch(`${BASE_URL}/api/v1/auth/mfa/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenFromRecovery}`
      },
      body: JSON.stringify({
        password: 'Admin@123456',
        recovery_code: recoveryCodes[1]
      })
    });
    const disableJson = await disableRes.json();
    assert(
      disableRes.status === 200,
      'TC-MFA-14: MFA Disabled Successfully with Password & Recovery Verification',
      `Message: "${disableJson?.message || 'OK'}"`
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
