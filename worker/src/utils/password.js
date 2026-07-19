import { PASSWORD } from "../config/constants.js";

/**
 * Encode ArrayBuffer to Base64URL
 */
function toBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);

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

    while (base64.length % 4) {
        base64 += "=";
    }

    const binary = atob(base64);

    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

/**
 * Hash a password using PBKDF2
 */
export async function hashPassword(password) {

    const salt = crypto.getRandomValues(
        new Uint8Array(PASSWORD.SALT_LENGTH)
    );

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        PASSWORD.ALGORITHM,
        false,
        ["deriveBits"]
    );

    const derived = await crypto.subtle.deriveBits(
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
        toBase64Url(salt),
        toBase64Url(derived)
    ].join("$");
}

/**
 * Verify password
 */
export async function verifyPassword(password, storedHash) {

    const parts = storedHash.split("$");

    if (parts.length !== 5) {
        return false;
    }

    const [
        algorithm,
        hashAlgorithm,
        iterations,
        saltEncoded,
        expectedHash
    ] = parts;

    if (algorithm !== "pbkdf2") {
        return false;
    }

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        PASSWORD.ALGORITHM,
        false,
        ["deriveBits"]
    );

    const derived = await crypto.subtle.deriveBits(
        {
            name: PASSWORD.ALGORITHM,
            hash: hashAlgorithm.toUpperCase(),
            salt: fromBase64Url(saltEncoded),
            iterations: Number(iterations)
        },
        keyMaterial,
        PASSWORD.KEY_LENGTH * 8
    );

    return toBase64Url(derived) === expectedHash;
}
