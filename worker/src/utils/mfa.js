/**
 * Multi-Factor Authentication (MFA / TOTP) Utilities
 * Standard: RFC 6238 (TOTP) / RFC 4226 (HOTP) / RFC 4648 (Base32)
 */

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
 */
export async function verifyTotpCode(base32Secret, inputCode, tolerance = 1) {
    if (!base32Secret || !inputCode) return false;
    const cleanCode = String(inputCode).trim().replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleanCode)) return false;

    const currentSlice = Math.floor(Date.now() / 1000 / 30);

    for (let offset = -tolerance; offset <= tolerance; offset++) {
        try {
            const expectedCode = await generateTotpCode(base32Secret, currentSlice + offset);
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
 * Derives a 256-bit AES-GCM encryption key from JWT_SECRET
 */
async function getEncryptionKey(jwtSecret) {
    const enc = new TextEncoder();
    const secretStr = jwtSecret || "roadlink-mfa-default-secret-key-2026";
    const digest = await crypto.subtle.digest("SHA-256", enc.encode(secretStr));
    return await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Encrypts plain Base32 secret string using AES-256-GCM
 */
export async function encryptMfaSecret(plainSecret, jwtSecret) {
    const key = await getEncryptionKey(jwtSecret);
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
export async function decryptMfaSecret(encryptedStr, jwtSecret) {
    if (!encryptedStr || !encryptedStr.includes(":")) return null;
    try {
        const [ivHex, cipherHex] = encryptedStr.split(":");
        const ivMatches = ivHex.match(/.{1,2}/g) || [];
        const cipherMatches = cipherHex.match(/.{1,2}/g) || [];

        const iv = new Uint8Array(ivMatches.map(byte => parseInt(byte, 16)));
        const cipher = new Uint8Array(cipherMatches.map(byte => parseInt(byte, 16)));

        const key = await getEncryptionKey(jwtSecret);
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            cipher
        );

        return new TextDecoder().decode(decrypted);
    } catch (err) {
        console.error("Failed to decrypt MFA secret:", err);
        return null;
    }
}

/**
 * Generates single-use 10-character recovery codes (e.g. A7K9-2P4M)
 */
export function generateRecoveryCodes(count = 8) {
    const codes = [];
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    for (let i = 0; i < count; i++) {
        const bytes = new Uint8Array(8);
        crypto.getRandomValues(bytes);
        let code = "";
        for (let j = 0; j < 8; j++) {
            code += chars[bytes[j] % chars.length];
        }
        codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }

    return codes;
}

/**
 * Hashes a recovery code for secure database storage (PBKDF2 or SHA-256)
 */
export async function hashRecoveryCode(code) {
    const cleanCode = String(code).toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest("SHA-256", enc.encode(`ROADLINK_RECOVERY_SALT_${cleanCode}`));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Builds standard OTPAuth URI string for QR code generation
 */
export function buildOtpAuthUrl(username, base32Secret, issuer = "Roadlink Automobiles") {
    const label = `${issuer}:${username}`;
    return `otpauth://totp/${encodeURIComponent(label)}?secret=${base32Secret}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6`;
}
