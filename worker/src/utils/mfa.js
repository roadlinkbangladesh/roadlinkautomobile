/**
 * Multi-Factor Authentication (MFA / TOTP) Utilities
 * Standard: RFC 6238 (TOTP) / RFC 4226 (HOTP) / RFC 4648 (Base32)
 */

import { hashPassword, verifyPassword } from "./password.js";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes a Uint8Array or Buffer into a Base32 string
 */
export function base32Encode(buffer) {
    const bytes = new Uint8Array(buffer);
    let bits = 0;
    let value = 0;
    let output = "";

    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
}

/**
 * Decodes a Base32 string into a Uint8Array
 */
export function base32Decode(input) {
    if (!input) return new Uint8Array(0);
    const cleaned = String(input).toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
    let bits = 0;
    let value = 0;
    const bytes = [];

    for (let i = 0; i < cleaned.length; i++) {
        const index = BASE32_ALPHABET.indexOf(cleaned[i]);
        if (index === -1) continue;
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return new Uint8Array(bytes);
}

/**
 * Generates a random 160-bit (20 bytes) Base32 secret for TOTP
 */
export function generateMfaSecret() {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return base32Encode(bytes);
}

/**
 * Generates a 6-digit TOTP code for a given Base32 secret and time slice
 * RFC 6238: 30-second interval, HMAC-SHA1
 */
export async function generateTotpCode(base32Secret, timeSlice) {
    const slice = timeSlice ?? Math.floor(Date.now() / 1000 / 30);
    const secretBytes = base32Decode(base32Secret);

    if (secretBytes.length === 0) {
        throw new Error("Invalid Base32 secret");
    }

    const key = await crypto.subtle.importKey(
        "raw",
        secretBytes,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
    );

    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigUint64(0, BigInt(slice), false); // Big-Endian uint64

    const signature = await crypto.subtle.sign("HMAC", key, buffer);
    const digest = new Uint8Array(signature);

    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff);

    const otp = (binary % 1000000).toString().padStart(6, "0");
    return otp;
}

/**
 * Verifies a 6-digit TOTP code against a Base32 secret with ±tolerance time steps (default ±1 step = 30s)
 * Supports replay prevention when lastUsedIso timestamp is provided.
 */
export async function verifyTotpCode(base32Secret, inputCode, tolerance = 1, lastUsedIso = null) {
    if (!base32Secret || !inputCode) return false;
    const cleanCode = String(inputCode).trim().replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleanCode)) return false;

    const currentSlice = Math.floor(Date.now() / 1000 / 30);
    let lastUsedSlice = null;
    if (lastUsedIso) {
        const parsedMs = new Date(lastUsedIso).getTime();
        if (!isNaN(parsedMs)) {
            lastUsedSlice = Math.floor(parsedMs / 1000 / 30);
        }
    }

    for (let offset = -tolerance; offset <= tolerance; offset++) {
        const slice = currentSlice + offset;
        if (lastUsedSlice !== null && slice <= lastUsedSlice) {
            // Replay protection: skip time steps that have already been consumed
            continue;
        }
        try {
            const expectedCode = await generateTotpCode(base32Secret, slice);
            if (expectedCode === cleanCode) {
                return true;
            }
        } catch {
            // Ignore error for invalid slice calculation
        }
    }

    return false;
}

/**
 * Validates encryption secret key to fail closed if missing, empty, or insecure
 */
export function validateEncryptionSecret(secret) {
    if (!secret || typeof secret !== "string") {
        throw new Error("MFA encryption secret is missing or invalid. Encryption operations cannot continue.");
    }
    const trimmed = secret.trim();
    if (trimmed.length < 32) {
        throw new Error("MFA encryption secret is insecure: minimum 32 characters required.");
    }
    const INSECURE_PATTERNS = [
        "12345678901234567890123456789012",
        "default-mfa-encryption-secret-key",
        "changethiskeytoasecure32charactersecret",
        "your-secure-mfa-encryption-secret-32"
    ];
    if (INSECURE_PATTERNS.includes(trimmed.toLowerCase())) {
        throw new Error("MFA encryption secret is set to an unsafe placeholder or default secret.");
    }
    return trimmed;
}

/**
 * Derives valid MFA encryption secret from environment (MFA_ENCRYPTION_KEY or fallback to JWT_SECRET)
 */
export function getMfaEncryptionSecret(env) {
    const key = env?.MFA_ENCRYPTION_KEY || env?.JWT_SECRET;
    return validateEncryptionSecret(key);
}

/**
 * Derives a 256-bit AES-GCM encryption key from a securely validated secret
 */
async function getEncryptionKey(secret) {
    const validSecret = validateEncryptionSecret(secret);
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest("SHA-256", enc.encode(validSecret));
    return await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Encrypts plain Base32 secret string using AES-256-GCM
 */
export async function encryptMfaSecret(plainSecret, secret) {
    const key = await getEncryptionKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainSecret);

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoded
    );

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
    const cipherHex = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, "0")).join("");

    return `${ivHex}:${cipherHex}`;
}

/**
 * Decrypts AES-256-GCM encrypted MFA secret string
 */
export async function decryptMfaSecret(encryptedStr, secret) {
    if (!encryptedStr || !encryptedStr.includes(":")) return null;
    try {
        const [ivHex, cipherHex] = encryptedStr.split(":");
        const ivMatches = ivHex.match(/.{1,2}/g) || [];
        const cipherMatches = cipherHex.match(/.{1,2}/g) || [];

        const iv = new Uint8Array(ivMatches.map(byte => parseInt(byte, 16)));
        const cipher = new Uint8Array(cipherMatches.map(byte => parseInt(byte, 16)));

        const key = await getEncryptionKey(secret);
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            cipher
        );

        return new TextDecoder().decode(decrypted);
    } catch {
        return null;
    }
}

/**
 * Generates single-use 10-character recovery codes (e.g. A7K9X-2P4MY)
 */
export function generateRecoveryCodes(count = 8) {
    const codes = [];
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    for (let i = 0; i < count; i++) {
        const bytes = new Uint8Array(10);
        crypto.getRandomValues(bytes);
        let code = "";
        for (let j = 0; j < 10; j++) {
            code += chars[bytes[j] % chars.length];
        }
        codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
    }

    return codes;
}

/**
 * Hashes a recovery code for secure database storage using PBKDF2-HMAC-SHA256
 */
export async function hashRecoveryCode(code) {
    const cleanCode = String(code).toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    if (!cleanCode) throw new Error("Invalid recovery code");
    return await hashPassword(cleanCode);
}

/**
 * Verifies a plain recovery code against a stored PBKDF2 hash
 */
export async function verifyRecoveryCode(code, storedHash) {
    if (!code || !storedHash || typeof storedHash !== "string") return false;
    const cleanCode = String(code).toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    if (!cleanCode) return false;
    if (!storedHash.startsWith("pbkdf2$")) {
        return false;
    }
    return await verifyPassword(cleanCode, storedHash);
}

/**
 * Builds standard OTPAuth URI string for QR code generation
 */
export function buildOtpAuthUrl(username, base32Secret, issuer = "Roadlink Automobiles") {
    const cleanIssuer = issuer || "Roadlink Automobiles";
    const cleanUser = username || "user";
    const encodedIssuer = encodeURIComponent(cleanIssuer);
    const encodedUser = encodeURIComponent(cleanUser);
    const label = `${encodedIssuer}:${encodedUser}`;
    return `otpauth://totp/${label}?secret=${base32Secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}
