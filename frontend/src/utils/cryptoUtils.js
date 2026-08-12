const DB_NAME = "e2ee_keystore";
const DB_VERSION = 1;
const STORE_NAME = "keys";

let cachedUserId = null;

async function getCurrentUserId() {
    if (cachedUserId) return cachedUserId;
    const res = await fetch("/accounts/user/", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch user info for E2EE key scoping");
    const data = await res.json();
    cachedUserId = data.id;
    return cachedUserId;
}

export function clearUserIdCache() {
    cachedUserId = null;
}


function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveKeyToDB(id, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.put({ id, key });
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getKeyFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = (e) => resolve(e.target.result?.key || null);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function clearDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}


function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function getCsrf() {
    return document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrftoken="))
        ?.split("=")[1];
}


// ---------------------------------------------------------------------------
// Status check - call this after login instead of blindly initializing.
// Tells the caller which of the three flows to run:
//   "ready"             -> local private key + server public key both exist, do nothing
//   "new_user"          -> neither exists, generate + upload a fresh keypair
//   "needs_device_link" -> server has a public key but this device has no
//                          matching private key -> send user to link-device screen
//   "needs_reupload"    -> local key exists but server is missing it (edge case)
// ---------------------------------------------------------------------------
export async function getE2EEStatus() {
    const userId = await getCurrentUserId();
    const PRIVATE_KEY_ID = `private_key_${userId}`;

    const localPrivateKey = await getKeyFromDB(PRIVATE_KEY_ID);

    const serverCheck = await fetch("/accounts/message_keys/get/me/", { credentials: "include" });
    const serverHasPublicKey = serverCheck.ok && !!(await serverCheck.json()).public_key;

    if (localPrivateKey && serverHasPublicKey) return "ready";
    if (!localPrivateKey && !serverHasPublicKey) return "new_user";
    if (!localPrivateKey && serverHasPublicKey) return "needs_device_link";
    return "needs_reupload";
}


// ---------------------------------------------------------------------------
// True new-user path only. Generates a fresh RSA keypair and uploads the
// public half. NOTE: extractable is `true` here (unlike the original version)
// because completeDeviceLinking() needs to export the private key later to
// hand it off to a new device. It never leaves this device as plaintext -
// it's always wrapped/encrypted before transmission.
// ---------------------------------------------------------------------------
export async function generateAndUploadKeypair() {
    const userId = await getCurrentUserId();
    const PRIVATE_KEY_ID = `private_key_${userId}`;
    const PUBLIC_KEY_ID = `public_key_${userId}`;

    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true, // extractable - required so this key can later be shared via device linking
        ["encrypt", "decrypt"]
    );

    const exportedPublicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const publicKeyBase64 = arrayBufferToBase64(exportedPublicKey);

    await saveKeyToDB(PRIVATE_KEY_ID, keyPair.privateKey);
    await saveKeyToDB(PUBLIC_KEY_ID, keyPair.publicKey);

    const response = await fetch("/accounts/message_keys/upload/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCsrf(),
        },
        credentials: "include",
        body: JSON.stringify({ publicKey: publicKeyBase64 }),
    });

    if (!response.ok) {
        await clearDB();
        throw new Error(`Failed to upload public key: ${response.status}`);
    }
}


// ---------------------------------------------------------------------------
// Device linking - lets a device that already holds the private key hand it
// off to a new device via a QR code + ECDH-derived one-time transport key.
// The server only ever sees ciphertext plus two ephemeral public keys.
// ---------------------------------------------------------------------------

async function generateEphemeralKeypair() {
    return crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
    );
}

async function deriveSharedAesKey(myPrivateKey, theirPublicKeyRaw) {
    const theirPublicKey = await crypto.subtle.importKey(
        "raw",
        theirPublicKeyRaw,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
    );
    return crypto.subtle.deriveKey(
        { name: "ECDH", public: theirPublicKey },
        myPrivateKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function importSharedPrivateKey(decryptedPkcs8) {
    return crypto.subtle.importKey(
        "pkcs8",
        decryptedPkcs8,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true, // keep extractable so this device can also link others later
        ["decrypt"]
    );
}

// ---------------------------------------------------------------------------
// Call this when the user clicks "Show QR code". Works automatically as
// source (has a key, will send it) or sink (has no key, will receive it) —
// whichever applies to this device.
// ---------------------------------------------------------------------------
export async function startLinkSession() {
    const userId = await getCurrentUserId();
    const localPrivateKey = await getKeyFromDB(`private_key_${userId}`);
    const iAmSource = !!localPrivateKey;

    const ephemeralKeyPair = await generateEphemeralKeypair();
    const sessionId = crypto.randomUUID();

    const startRes = await fetch("/accounts/message_keys/link/start/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
        credentials: "include",
        body: JSON.stringify({ sessionId, role: iAmSource ? "source" : "sink" }),
    });
    if (!startRes.ok) throw new Error("Failed to start linking session");

    const exportedPub = await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey);
    const qrPayload = JSON.stringify({
        sessionId,
        pubKey: arrayBufferToBase64(exportedPub),
    });

    async function waitForCompletion({ signal, intervalMs = 2000, timeoutMs = 120000 } = {}) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (signal?.aborted) throw new Error("cancelled");

            const res = await fetch(`/accounts/message_keys/link/poll/?sessionId=${sessionId}`, {
                credentials: "include",
            });

            if (res.ok) {
                const data = await res.json();

                if (data.status === "completed") {
                    // We were the sink: decrypt and store the key we received.
                    const senderPubKeyRaw = base64ToArrayBuffer(data.senderPubKey);
                    const sharedKey = await deriveSharedAesKey(ephemeralKeyPair.privateKey, senderPubKeyRaw);
                    const decrypted = await crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: base64ToArrayBuffer(data.iv) },
                        sharedKey,
                        base64ToArrayBuffer(data.encryptedPrivateKey)
                    );
                    const privateKey = await importSharedPrivateKey(decrypted);
                    await saveKeyToDB(`private_key_${userId}`, privateKey);
                    return true;
                }

                if (data.status === "awaiting_source") {
                    // The scanner has no key and is waiting on us. Only makes
                    // sense if we're the source.
                    if (!iAmSource) {
                        await fetch("/accounts/message_keys/link/fail/", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
                            credentials: "include",
                            body: JSON.stringify({ sessionId, message: "Neither device has a key to share." }),
                        });
                        throw new Error("Neither device has a key to share yet.");
                    }

                    const responderPubKeyRaw = base64ToArrayBuffer(data.responderPubKey);
                    const sharedKey = await deriveSharedAesKey(ephemeralKeyPair.privateKey, responderPubKeyRaw);

                    const privateKey = await getKeyFromDB(`private_key_${userId}`);
                    const exportedPrivateKey = await crypto.subtle.exportKey("pkcs8", privateKey);
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    const encryptedPrivateKey = await crypto.subtle.encrypt(
                        { name: "AES-GCM", iv },
                        sharedKey,
                        exportedPrivateKey
                    );
                    const exportedOwnPub = await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey);

                    const deliverRes = await fetch("/accounts/message_keys/link/deliver/", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
                        credentials: "include",
                        body: JSON.stringify({
                            sessionId,
                            senderPubKey: arrayBufferToBase64(exportedOwnPub),
                            encryptedPrivateKey: arrayBufferToBase64(encryptedPrivateKey),
                            iv: arrayBufferToBase64(iv),
                        }),
                    });
                    if (!deliverRes.ok) throw new Error("Failed to deliver key to the other device");
                    return true; // we already had the key, nothing further to store
                }

                if (data.status === "error") {
                    throw new Error(data.message || "Linking failed");
                }
            }

            await new Promise((r) => setTimeout(r, intervalMs));
        }
        throw new Error("Linking timed out");
    }

    return { qrPayload, iAmSource, waitForCompletion };
}

// ---------------------------------------------------------------------------
// Call this when the user scans a QR code. Works automatically as source
// or sink, whichever applies to this device.
// ---------------------------------------------------------------------------
export async function respondToScannedQr(scannedQrText) {
    const { sessionId, pubKey } = JSON.parse(scannedQrText);
    const initiatorPubKeyRaw = base64ToArrayBuffer(pubKey);

    const userId = await getCurrentUserId();
    const localPrivateKey = await getKeyFromDB(`private_key_${userId}`);
    const iAmSource = !!localPrivateKey;

    const ephemeralKeyPair = await generateEphemeralKeypair();
    const sharedKey = await deriveSharedAesKey(ephemeralKeyPair.privateKey, initiatorPubKeyRaw);
    const exportedOwnPub = await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey);

    if (iAmSource) {
        const exportedPrivateKey = await crypto.subtle.exportKey("pkcs8", localPrivateKey);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedPrivateKey = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            sharedKey,
            exportedPrivateKey
        );

        const res = await fetch("/accounts/message_keys/link/respond/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
            credentials: "include",
            body: JSON.stringify({
                sessionId,
                responderPubKey: arrayBufferToBase64(exportedOwnPub),
                encryptedPrivateKey: arrayBufferToBase64(encryptedPrivateKey),
                iv: arrayBufferToBase64(iv),
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Failed to complete linking");
        }
        return { iAmSource: true, done: true };
    }

    // We have no key: register and wait for the other device to deliver it.
    const res = await fetch("/accounts/message_keys/link/respond/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
        credentials: "include",
        body: JSON.stringify({ sessionId, responderPubKey: arrayBufferToBase64(exportedOwnPub) }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to join linking session");
    }

    async function waitForKey({ signal, intervalMs = 2000, timeoutMs = 120000 } = {}) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (signal?.aborted) throw new Error("cancelled");

            const pollRes = await fetch(`/accounts/message_keys/link/poll/?sessionId=${sessionId}`, {
                credentials: "include",
            });

            if (pollRes.ok) {
                const data = await pollRes.json();

                if (data.status === "completed") {
                    // Same ECDH shared secret we already derived above
                    // (shared(scannerPriv, initiatorPub) === shared(initiatorPriv, scannerPub)).
                    const decrypted = await crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: base64ToArrayBuffer(data.iv) },
                        sharedKey,
                        base64ToArrayBuffer(data.encryptedPrivateKey)
                    );
                    const privateKey = await importSharedPrivateKey(decrypted);
                    await saveKeyToDB(`private_key_${userId}`, privateKey);
                    return true;
                }

                if (data.status === "error") {
                    throw new Error(data.message || "Linking failed");
                }
            }

            await new Promise((r) => setTimeout(r, intervalMs));
        }
        throw new Error("Linking timed out");
    }

    return { iAmSource: false, done: false, waitForKey };
}

export async function encryptMessage(text, publicKeyBase64) {
    try {
        const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
        const publicKey = await window.crypto.subtle.importKey(
            "spki",
            publicKeyBuffer,
            { name: "RSA-OAEP", hash: "SHA-256" },
            false,
            ["encrypt"]
        );

        const encodedText = new TextEncoder().encode(text);

        const encryptedBuffer = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            publicKey,
            encodedText
        );

        return arrayBufferToBase64(encryptedBuffer);
    } catch (error) {
        throw error;
    }
}


export async function decryptMessage(encryptedBase64) {
    try {
        const userId = await getCurrentUserId();
        const privateKey = await getKeyFromDB(`private_key_${userId}`);

        if (!privateKey) {
            throw new Error("Private key not found in IndexedDB. Re-initialize E2EE.");
        }

        const encryptedBuffer = base64ToArrayBuffer(encryptedBase64);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encryptedBuffer
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
        return "[Mesaj criptat sau eroare de decriptare]";
    }
}