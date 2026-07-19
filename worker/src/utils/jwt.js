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

async function importKey(secret) {

    return crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
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

    if (!token) {
        return null;
    }

    const parts = token.split(".");

    if (parts.length !== 3) {
        return null;
    }

    const [header, payload, signature] = parts;

    const valid = await verify(
        `${header}.${payload}`,
        signature,
        secret
    );

    if (!valid) {
        return null;
    }

    const data = JSON.parse(
        new TextDecoder().decode(
            base64UrlDecode(payload)
        )
    );

    const now = Math.floor(Date.now() / 1000);

    if (data.exp < now) {
        return null;
    }

    return data;

}
