// Pool 64 akun Cloudflare AI. Versi server-side jauh lebih sederhana dari Kotlin client:
// Worker isolate stateless dan generate dipicu manual oleh admin (tidak ada burst dari banyak user),
// jadi tidak perlu cooldown 24 jam yang persisten.
//
// Strategi: shuffle slot saat instansiasi, lalu loop urut + skip yang sudah gagal di attempt ini.

export interface AccountSlot {
  id: number;
  accountId: string;
  token: string;
}

interface RawSlot {
  id: number;
  ns?: string;
  account_id?: string;
  tk?: string;
  api_key?: string;
}

export function parseAccountPool(json: string): AccountSlot[] {
  const raw = JSON.parse(json) as RawSlot[];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("ACCOUNT_POOL_JSON kosong atau bukan array");
  }
  return raw.map((r) => {
    const accountId = r.ns ?? r.account_id;
    const token = r.tk ?? r.api_key;
    if (!accountId || !token) {
      throw new Error(`Slot id=${r.id} tidak punya accountId/token`);
    }
    return { id: r.id, accountId, token };
  });
}

export class QuotaExhaustedError extends Error {
  constructor() {
    super("Semua slot Cloudflare AI habis kuota / gagal di attempt ini");
    this.name = "QuotaExhaustedError";
  }
}

/** Iterator slot yang tahan-lama dalam satu operasi (1× generateRecipe / generateImage). */
export class PoolIterator {
  private failed = new Set<number>();
  private order: AccountSlot[];

  constructor(slots: AccountSlot[]) {
    this.order = shuffle(slots.slice());
  }

  next(): AccountSlot {
    for (const slot of this.order) {
      if (!this.failed.has(slot.id)) return slot;
    }
    throw new QuotaExhaustedError();
  }

  markFailed(slotId: number) {
    this.failed.add(slotId);
  }

  remaining(): number {
    return this.order.length - this.failed.size;
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
