
const DB_NAME = "e2ee_keystore";
const DB_VERSION = 1;
const STORE_NAME = "keys";

let cachedUserId = null;

async function getCurrentUserId() {
    if (cachedUserId) return cachedUserId;
    const res = await fetch("http://localhost:8000/accounts/user/", { credentials: "include" });
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


export async function initializeE2EE() {
    try {
        const userId = await getCurrentUserId();
        const PRIVATE_KEY_ID = `private_key_${userId}`;
        const PUBLIC_KEY_ID = `public_key_${userId}`;

        const existingPrivateKey = await getKeyFromDB(PRIVATE_KEY_ID);

        const serverCheck = await fetch(
            "http://localhost:8000/accounts/message_keys/get/me/",
            { credentials: "include" }
        );
        const keyExistsOnServer = serverCheck.ok && (await serverCheck.json()).public_key;

        if (existingPrivateKey && keyExistsOnServer) {
            console.log("E2EE keys already exist.");
            return;
        }

        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            false,
            ["encrypt", "decrypt"]
        );

        const exportedPublicKey = await window.crypto.subtle.exportKey(
            "spki",
            keyPair.publicKey
        );
        const publicKeyBase64 = arrayBufferToBase64(exportedPublicKey);

        await saveKeyToDB(PRIVATE_KEY_ID, keyPair.privateKey);
        await saveKeyToDB(PUBLIC_KEY_ID, keyPair.publicKey);

        const csrfToken = document.cookie
            .split("; ")
            .find((row) => row.startsWith("csrftoken="))
            ?.split("=")[1];

        const response = await fetch(
            "http://localhost:8000/accounts/message_keys/upload/",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken,
                },
                credentials: "include",
                body: JSON.stringify({ publicKey: publicKeyBase64 }),
            }
        );

        if (response.ok) {
            console.log("Public key uploaded successfully.");
        } else {
            await clearDB();
            console.error("Failed to upload public key:", response.status);
        }
    } catch (error) {
        console.error("Error initializing E2EE:", error);
    }
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
