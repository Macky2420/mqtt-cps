import { db } from "../database/firebase";
import { ref, get, set, update, push, remove } from "firebase/database";

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

export async function saveCard(card: RFIDCard) {
  await set(ref(db, `rfid_users/${card.id}`), card);
}

export async function deleteCard(cardId: string) {
  await remove(ref(db, `rfid_users/${cardId}`));
}

export async function findCardByNumber(number: string): Promise<RFIDCard | null> {
  const cleanNumber = number.trim().toUpperCase();

  const snapshot = await get(ref(db, `rfid_users/${cleanNumber}`));

  if (snapshot.exists()) {
    return snapshot.val() as RFIDCard;
  }

  return null;
}

export async function updateCardBalance(cardId: string, newBalance: number) {
  await update(ref(db, `rfid_users/${cardId}`), {
    balance: newBalance,
  });
}

export async function topUpCardBalance(cardId: string, newBalance: number) {
  await update(ref(db, `rfid_users/${cardId}`), {
    balance: newBalance,
  });
}

// ===== TRANSACTIONS =====
export async function addTransaction(transaction: Transaction) {
  const newRef = push(ref(db, "transactions"));
  await set(newRef, {
    ...transaction,
    id: newRef.key,
  });
}

export interface ManualIncome {
  id: string;
  timestamp: number;
  amount: number;
  description: string;
  type: "cash" | "other";
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
  await set(newRef, {
    ...income,
    id: newRef.key,
  });
}

export async function deleteManualIncome(id: string) {
  await remove(ref(db, `manual_income/${id}`));
}

export async function getTotalIncome(): Promise<number> {
  const transactions = await getTransactions();
  const manualIncome = await getManualIncome();

  const transactionIncome = transactions.reduce((sum, t) => sum + t.total, 0);
  const manualIncomeTotal = manualIncome.reduce((sum, i) => sum + i.amount, 0);

  return transactionIncome + manualIncomeTotal;
}