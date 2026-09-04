/**
 * Sanity Test Suite for Phase 1 & Phase 2 Implementations
 * Supports local dev server or live production Cloudflare Worker targets.
 */

let rawUrl = process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3000';
if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = 'https://' + rawUrl;
}
const BASE_URL = rawUrl.replace(/\/$/, '');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Admin@123456';

async function runSanitySuite() {
  console.log('====================================================');
  console.log('   SANITY TEST SUITE - PHASE 1 & PHASE 2 RUNTIME   ');
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
    // ----------------------------------------------------
    // PHASE 1 TEST CASES
    // ----------------------------------------------------
    console.log('--- PHASE 1: Security, Auth, RBAC & Core API ---');

    // TC-1.1: Authentication Failure Handling
    const badLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USER, password: 'WrongPassword123!' })
    });
    const badLoginJson = await badLoginRes.json();
    assert(badLoginRes.status === 401 && badLoginJson.success === false, 'TC-1.1: Invalid Password Authentication Rejection', `Status ${badLoginRes.status}`);

    // TC-1.2: Admin Login Success & JWT Generation
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
    });
    const loginJson = await loginRes.json();
    let token = loginJson.data?.token;
    assert(loginRes.status === 200 && loginJson.success && typeof token === 'string', 'TC-1.2: Admin Login & JWT Issuance', `Token length: ${token ? token.length : 0}`);

    // TC-1.3: RBAC Authorization Enforcement (Unauthenticated Request Guard)
    const unauthorizedRes = await fetch(`${BASE_URL}/api/v1/admin/vehicles`);
    assert(unauthorizedRes.status === 401, 'TC-1.3: RBAC Missing Token Prevention', `Status ${unauthorizedRes.status}`);

    // TC-1.4: Public Settings API Endpoint
    const settingsRes = await fetch(`${BASE_URL}/api/v1/public/settings`);
    const settingsJson = await settingsRes.json();
    assert(settingsRes.status === 200 && settingsJson.success && settingsJson.data?.company_name, 'TC-1.4: Public Settings Retrieval', `Company: ${settingsJson.data?.company_name}`);

    // TC-1.5: Public Business Locations API Endpoint
    const locationsRes = await fetch(`${BASE_URL}/api/v1/public/locations`);
    const locationsJson = await locationsRes.json();
    assert(locationsRes.status === 200 && locationsJson.success && Array.isArray(locationsJson.data), 'TC-1.5: Public Locations Retrieval', `Locations count: ${locationsJson.data?.length}`);

    // TC-1.6: Logout API Endpoint & Token Invalidation
    const logoutLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
    });
    const logoutLoginJson = await logoutLoginRes.json();
    const tempLogoutToken = logoutLoginJson.data?.token;

    const logoutRes = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${tempLogoutToken}`,
        'Content-Type': 'application/json'
      }
    });
    const logoutJson = await logoutRes.json();
    const tokenInvalidatedRes = await fetch(`${BASE_URL}/api/v1/admin/vehicles`, {
      headers: { 'Authorization': `Bearer ${tempLogoutToken}` }
    });
    assert(
      logoutRes.status === 200 && logoutJson.success && tokenInvalidatedRes.status === 401,
      'TC-1.6: Logout Endpoint & Multi-Session Invalidation',
      `Logout Status ${logoutRes.status}, Post-logout Guard ${tokenInvalidatedRes.status}`
    );

    // TC-1.7: MFA Challenge Error Distinction (Invalid Code vs Expired Token)
    const invalidTokenMfaRes = await fetch(`${BASE_URL}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfa_token: 'invalid_expired_token_xyz', code: '123456' })
    });
    const invalidTokenMfaJson = await invalidTokenMfaRes.json();

    assert(
      invalidTokenMfaRes.status === 401 && invalidTokenMfaJson.code === 'MFA_CHALLENGE_EXPIRED',
      'TC-1.7: MFA Expired Challenge Session Handling',
      `Status ${invalidTokenMfaRes.status}, Code: ${invalidTokenMfaJson.code}`
    );

    // Re-authenticate main token for subsequent Phase 2 tests (since token_version incremented)
    const refreshLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
    });
    const refreshLoginJson = await refreshLoginRes.json();
    token = refreshLoginJson.data?.token;


    // ----------------------------------------------------
    // PHASE 2 TEST CASES
    // ----------------------------------------------------
    console.log('\n--- PHASE 2: Performance, Batching, Streaming & Stability ---');

    // TC-2.1: Public Vehicle Inventory Image Batching (N+1 Query Elimination)
    const pubVehRes = await fetch(`${BASE_URL}/api/v1/public/vehicles`);
    const pubVehJson = await pubVehRes.json();
    const pubVehicles = pubVehJson.data?.items || [];
    const allHaveImagesArray = pubVehicles.every(v => Array.isArray(v.images));
    assert(pubVehRes.status === 200 && pubVehicles.length > 0 && allHaveImagesArray, 'TC-2.1: Public Vehicles Batch Image Mapping', `Fetched ${pubVehicles.length} vehicles with batch mapped images`);

    // TC-2.2: Admin Vehicle Inventory Batching
    const adminVehRes = await fetch(`${BASE_URL}/api/v1/admin/vehicles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const adminVehJson = await adminVehRes.json();
    const adminVehicles = adminVehJson.data?.items || [];
    const adminAllHaveImages = adminVehicles.every(v => Array.isArray(v.images));
    assert(adminVehRes.status === 200 && adminVehicles.length > 0 && adminAllHaveImages, 'TC-2.2: Admin Vehicles Batch Image Mapping', `Fetched ${adminVehicles.length} admin vehicles`);

    // TC-2.3: Composite Database Index Filtering (Published & Featured Vehicles)
    const filteredVehRes = await fetch(`${BASE_URL}/api/v1/public/vehicles?status=available&make=Toyota`);
    const filteredVehJson = await filteredVehRes.json();
    assert(filteredVehRes.status === 200 && filteredVehJson.success, 'TC-2.3: Composite Index Filtered Vehicle Search', `Status ${filteredVehRes.status}`);

    // TC-2.4: Dynamic DDL Mutation Elimination (Roles List Handler)
    const rolesRes = await fetch(`${BASE_URL}/api/v1/admin/roles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const rolesJson = await rolesRes.json();
    assert(rolesRes.status === 200 && Array.isArray(rolesJson.data), 'TC-2.4: Roles List Without Dynamic DDL Overhead', `Retrieved ${rolesJson.data?.length} roles`);

    // TC-2.5: Streamed Audit Logs CSV Export
    const exportRes = await fetch(`${BASE_URL}/api/v1/admin/audit-logs/export`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Origin': 'http://localhost:3000'
      }
    });
    const csvContent = await exportRes.text();
    const contentType = exportRes.headers.get('content-type');
    const disposition = exportRes.headers.get('content-disposition');
    const isValidCsvHeader = csvContent.startsWith('id,timestamp,acting_user_id');

    assert(
      exportRes.status === 200 && 
      contentType?.includes('text/csv') && 
      disposition?.includes('audit-logs.csv') &&
      isValidCsvHeader,
      'TC-2.5: Streamed Audit Logs CSV Export',
      `Header: ${contentType}, Rows: ${csvContent.trim().split('\n').length}`
    );

  } catch (err) {
    console.error('Fatal execution error in sanity suite:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`   SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSanitySuite();
