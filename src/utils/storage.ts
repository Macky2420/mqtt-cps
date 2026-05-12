import { db, auth } from "../database/firebase";
import { ref, get, set, update, push, remove } from "firebase/database";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// ===== TYPES =====
export interface Product {
  id: string;
  name: string;
  price: number;
  category?: string;
}

export interface RFIDCard {
  id: string;
  number: string;
  name: string;
  balance: number;
  userId?: string;        // Bound user account
  userEmail?: string;     // Bound user email
  createdAt?: number;
}

export interface Transaction {
  id: string;
  timestamp: number;
  items: Array<{
    productId: string;
    productName: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  cardNumber: string;
  cardName: string;
  type?: "purchase" | "topup";
}

export interface ManualIncome {
  id: string;
  timestamp: number;
  amount: number;
  description: string;
  type: "cash" | "other";
}

export interface AppUser {
  uid: string;
  email: string;
  fullName: string;
  role: "admin" | "user";
  rfidNumber?: string;
  createdAt: number;
}

// ─── NEW: Top-Up Transaction Type ─────────────────────────────
export interface TopUpTransaction {
  id: string;
  timestamp: number;
  cardId: string;
  cardNumber: string;
  cardName: string;
  userId: string;
  userEmail: string;
  amount: number;
  method: "paypal" | "maya" | "gcash";
  status: "pending" | "success" | "failed";
  referenceCode: string;
  previousBalance: number;
  newBalance: number;
}

// ===== AUTH =====
export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  rfidNumber: string,
  initialBalance: number
): Promise<AppUser> {
  // 1. Create Firebase Auth user
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const firebaseUser = userCredential.user;

  // 2. Create RFID card in database
  const card: RFIDCard = {
    id: rfidNumber.toUpperCase(),
    number: rfidNumber.toUpperCase(),
    name: fullName,
    balance: initialBalance,
    userId: firebaseUser.uid,
    userEmail: firebaseUser.email!,
    createdAt: Date.now(),
  };
  await set(ref(db, `rfid_users/${card.id}`), card);

  // 3. Save user profile with role
  const appUser: AppUser = {
    uid: firebaseUser.uid,
    email: firebaseUser.email!,
    fullName,
    role: "user", // All registered users are normal users
    rfidNumber: rfidNumber.toUpperCase(),
    createdAt: Date.now(),
  };
  await set(ref(db, `users/${firebaseUser.uid}`), appUser);

  return appUser;
}

export async function loginUser(email: string, password: string): Promise<AppUser> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const firebaseUser = userCredential.user;

  // Get user profile from database
  const snapshot = await get(ref(db, `users/${firebaseUser.uid}`));

  if (!snapshot.exists()) {
    // Auto-create profile if missing (for admin or legacy users)
    const newUser: AppUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email!,
      fullName: firebaseUser.displayName || "User",
      role: email === "admin@cashlesspay.com" ? "admin" : "user",
      createdAt: Date.now(),
    };

    await set(ref(db, `users/${firebaseUser.uid}`), newUser);
    return newUser;
  }

  return snapshot.val() as AppUser;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function getCurrentUser(callback: (user: AppUser | null) => void) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    const snapshot = await get(ref(db, `users/${firebaseUser.uid}`));
    if (snapshot.exists()) {
      callback(snapshot.val() as AppUser);
    } else {
      callback(null);
    }
  });
}

// ===== PRODUCTS =====
export async function getProducts(): Promise<Product[]> {
  const snapshot = await get(ref(db, "products"));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as Product[];
}

export async function saveProduct(product: Product) {
  await set(ref(db, `products/${product.id}`), product);
}

export async function deleteProduct(productId: string) {
  await remove(ref(db, `products/${productId}`));
}

// ===== RFID CARDS =====
export async function getCards(): Promise<RFIDCard[]> {
  const snapshot = await get(ref(db, "rfid_users"));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as RFIDCard[];
}

export async function getAllCards(): Promise<RFIDCard[]> {
  return getCards(); // Alias for consistency
}

export async function saveCard(card: RFIDCard) {
  await set(ref(db, `rfid_users/${card.id}`), card);
}

export async function deleteCard(cardId: string) {
  await remove(ref(db, `rfid_users/${cardId}`));
}

export async function findCardByNumber(number: string): Promise<RFIDCard | null> {
  const cleanNumber = number.trim().toUpperCase();
  const snapshot = await get(ref(db, `rfid_users/${cleanNumber}`));
  if (snapshot.exists()) return snapshot.val() as RFIDCard;
  return null;
}

export async function updateCardBalance(cardId: string, newBalance: number) {
  await update(ref(db, `rfid_users/${cardId}`), { balance: newBalance });
}

export async function topUpCardBalance(cardId: string, newBalance: number) {
  await update(ref(db, `rfid_users/${cardId}`), { balance: newBalance });
}

// ===== TRANSACTIONS =====
export async function addTransaction(transaction: Transaction) {
  const newRef = push(ref(db, "transactions"));
  await set(newRef, { ...transaction, id: newRef.key });
}

export async function getTransactions(): Promise<Transaction[]> {
  const snapshot = await get(ref(db, "transactions"));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as Transaction[];
}

export async function getManualIncome(): Promise<ManualIncome[]> {
  const snapshot = await get(ref(db, "manual_income"));
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val()) as ManualIncome[];
}

export async function addManualIncome(income: ManualIncome) {
  const newRef = push(ref(db, "manual_income"));
  await set(newRef, { ...income, id: newRef.key });
}

export async function deleteManualIncome(id: string) {
  await remove(ref(db, `manual_income/${id}`));
}

export async function getTotalIncome(): Promise<number> {
  const [transactions, manualIncome] = await Promise.all([
    getTransactions(),
    getManualIncome(),
  ]);

  const transactionIncome = transactions.reduce((sum, t) => sum + t.total, 0);
  const manualIncomeTotal = manualIncome.reduce((sum, i) => sum + i.amount, 0);

  return transactionIncome + manualIncomeTotal;
}

// ─── NEW: Top-Up Functions (Realtime Database version) ───────

export async function addTopUpTransaction(tx: TopUpTransaction): Promise<void> {
  const newRef = push(ref(db, "topup_transactions"));
  await set(newRef, { ...tx, id: newRef.key });
}

export async function getTopUpTransactions(
  cardId?: string,
  userId?: string,
  limit: number = 50
): Promise<TopUpTransaction[]> {
  const snapshot = await get(ref(db, "topup_transactions"));
  if (!snapshot.exists()) return [];

  let transactions = Object.values(snapshot.val()) as TopUpTransaction[];

  // Sort by timestamp descending (newest first)
  transactions.sort((a, b) => b.timestamp - a.timestamp);

  // Filter if needed
  if (cardId) {
    transactions = transactions.filter((tx) => tx.cardId === cardId);
  }
  if (userId) {
    transactions = transactions.filter((tx) => tx.userId === userId);
  }

  return transactions.slice(0, limit);
}

export async function getCardTopUpHistory(cardId: string): Promise<TopUpTransaction[]> {
  const snapshot = await get(ref(db, "topup_transactions"));
  if (!snapshot.exists()) return [];

  const transactions = Object.values(snapshot.val()) as TopUpTransaction[];

  return transactions
    .filter((tx) => tx.cardId === cardId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function bindCardToUser(
  cardId: string,
  userId: string,
  userEmail: string
): Promise<void> {
  await update(ref(db, `rfid_users/${cardId}`), {
    userId,
    userEmail,
  });
}