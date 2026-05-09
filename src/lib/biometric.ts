const BIOMETRIC_KEY = "amel-biometric-credential";
const BIOMETRIC_ENABLED_KEY = "amel-biometric-enabled";

export function isBiometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "credentials" in navigator &&
    typeof PublicKeyCredential !== "undefined"
  );
}

export function isBiometricEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  return (
    localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true" &&
    !!localStorage.getItem(BIOMETRIC_KEY)
  );
}

export async function registerBiometric(userId: string, displayName: string): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId.slice(0, 32).padEnd(32, "0"));
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "AMEL Logbook", id: window.location.hostname },
      user: { id: userIdBytes, name: displayName, displayName },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential;
  const rawId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
  localStorage.setItem(BIOMETRIC_KEY, rawId);
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
}

export async function verifyBiometric(): Promise<boolean> {
  const stored = localStorage.getItem(BIOMETRIC_KEY);
  if (!stored) return false;
  const credId = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: "public-key", id: credId }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export function disableBiometric(): void {
  localStorage.removeItem(BIOMETRIC_KEY);
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
}
