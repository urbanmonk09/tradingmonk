// firebase/admin.ts
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_ADMIN_CREDENTIALS;

  if (!raw) {
    throw new Error("Missing FIREBASE_ADMIN_CREDENTIALS in environment");
  }

  const serviceAccount = JSON.parse(raw);

  // Fix private_key: remove escaped "\\n" so Firebase accepts it
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

export const adminDb = admin.firestore();
