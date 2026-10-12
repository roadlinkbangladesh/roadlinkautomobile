function base64UrlEncode(bytes) {

    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

}

function base64UrlDecode(text) {

    text = text
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    while (text.length % 4) {
        text += "=";
    }

    return Uint8Array.from(
        atob(text),
        c => c.charCodeAt(0)
    );

}

export function validateJwtSecret(secret) {
    if (!secret || typeof secret !== "string") {
        throw new Error("JWT_SECRET is missing, empty, or invalid. Authentication operations cannot continue.");
    }
    const trimmed = secret.trim();
    if (trimmed.length < 32) {
        throw new Error("JWT_SECRET is insecure: minimum 32 characters required.");
    }
    const INSECURE_PATTERNS = [
        "12345678901234567890123456789012",
        "default-jwt-secret-key-change-me",
        "changethiskeytoasecure32charactersecret",
        "your-secure-jwt-secret-minimum-32-chars-long"
    ];
    if (INSECURE_PATTERNS.includes(trimmed.toLowerCase())) {
        throw new Error("JWT_SECRET is set to an unsafe placeholder or default secret.");
    }
    return trimmed;
}

async function importKey(secret) {
    const validSecret = validateJwtSecret(secret);

    return crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(validSecret),
        {
            name: "HMAC",
            hash: "SHA-256"
        },
        false,
        ["sign", "verify"]
    );
}

async function sign(data, secret) {

    const key = await importKey(secret);

    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(data)
    );

    return base64UrlEncode(
        new Uint8Array(signature)
    );

}

export async function createToken(payload, secret, expiresIn) {

    const now = Math.floor(Date.now() / 1000);

    const header = {
        alg: "HS256",
        typ: "JWT"
    };

    const body = {
        ...payload,
        iat: now,
        exp: now + expiresIn
    };

    const encodedHeader = base64UrlEncode(
        new TextEncoder().encode(
            JSON.stringify(header)
        )
    );

    const encodedBody = base64UrlEncode(
        new TextEncoder().encode(
            JSON.stringify(body)
        )
    );

    const unsignedToken =
        `${encodedHeader}.${encodedBody}`;

    const signature = await sign(
        unsignedToken,
        secret
    );

    return `${unsignedToken}.${signature}`;

}

async function verify(data, signature, secret) {

    const key = await importKey(secret);

    return crypto.subtle.verify(
        "HMAC",
        key,
        base64UrlDecode(signature),
        new TextEncoder().encode(data)
    );

}

export async function verifyToken(token, secret) {
    try {
        if (!token || typeof token !== "string") {
            return null;
        }

        // Validate key before processing
        const validSecret = validateJwtSecret(secret);

        const parts = token.split(".");

        if (parts.length !== 3) {
            return null;
        }

        const [headerB64, payloadB64, signature] = parts;

        // Decode and enforce expected header algorithm (HS256)
        const headerJson = new TextDecoder().decode(base64UrlDecode(headerB64));
        const header = JSON.parse(headerJson);
        if (!header || header.alg !== "HS256") {
            return null;
        }
        if (header.typ && header.typ.toUpperCase() !== "JWT") {
            return null;
        }

        const valid = await verify(
            `${headerB64}.${payloadB64}`,
            signature,
            validSecret
        );

        if (!valid) {
            return null;
        }

        const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
        const data = JSON.parse(payloadJson);

        const now = Math.floor(Date.now() / 1000);

        if (typeof data.exp !== "number" || data.exp < now) {
            return null;
        }

        if (typeof data.nbf === "number" && data.nbf > now) {
            return null;
        }

        return data;
    } catch {
        return null;
    }
}
