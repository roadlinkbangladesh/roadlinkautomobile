import { PASSWORD } from "../config/constants.js";

const encoder = new TextEncoder();

/**
 * Encode Uint8Array to Base64URL
 */
function toBase64Url(bytes) {
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/**
 * Decode Base64URL to Uint8Array
 */
function fromBase64Url(value) {
    let base64 = value
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    while (base64.length % 4 !== 0) {
        base64 += "=";
    }

    const binary = atob(base64);

    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

/**
 * Constant-time byte comparison.
 */
function constantTimeEqual(a, b) {

    if (a.length !== b.length) {
        return false;
    }

    let diff = 0;

    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }

    return diff === 0;
}

/**
 * Creates a PBKDF2 password hash.
 *
 * Format:
 * pbkdf2$sha256$600000$32$salt$hash
 */
export async function hashPassword(password) {

    const salt = crypto.getRandomValues(
        new Uint8Array(PASSWORD.SALT_LENGTH)
    );

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        PASSWORD.ALGORITHM,
        false,
        ["deriveBits"]
    );

    const derivedKey = await crypto.subtle.deriveBits(
        {
            name: PASSWORD.ALGORITHM,
            hash: PASSWORD.HASH,
            salt,
            iterations: PASSWORD.ITERATIONS
        },
        keyMaterial,
        PASSWORD.KEY_LENGTH * 8
    );

    return [
        "pbkdf2",
        PASSWORD.HASH.toLowerCase(),
        PASSWORD.ITERATIONS,
        PASSWORD.KEY_LENGTH,
        toBase64Url(salt),
        toBase64Url(new Uint8Array(derivedKey))
    ].join("$");
}

/**
 * Verifies a password against a stored PBKDF2 hash.
 */
export async function verifyPassword(password, storedHash) {

    const parts = storedHash.split("$");

    if (parts.length !== 6) {
        return false;
    }

    const [
        algorithm,
        hashAlgorithm,
        iterations,
        keyLength,
        saltEncoded,
        expectedHashEncoded
    ] = parts;

    if (algorithm !== "pbkdf2") {
        return false;
    }

    const salt = fromBase64Url(saltEncoded);
    const expectedHash = fromBase64Url(expectedHashEncoded);

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        PASSWORD.ALGORITHM,
        false,
        ["deriveBits"]
    );

    const derivedKey = await crypto.subtle.deriveBits(
        {
            name: PASSWORD.ALGORITHM,
            hash: hashAlgorithm.toUpperCase(),
            salt,
            iterations: Number(iterations)
        },
        keyMaterial,
        Number(keyLength) * 8
    );

    return constantTimeEqual(
        new Uint8Array(derivedKey),
        expectedHash
    );
}
