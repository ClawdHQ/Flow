import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

export interface RoundAllocationRecord {
  id: string;
  round_id: string;
  creator_id: string;
  payout_address: string;
  payout_family: string;
  payout_network: string;
  payout_token: string;
  direct_tips: string;
  match_amount: string;
  score: string;
  unique_tippers: number;
  settlement_mode: string;
  tx_hash?: string;
  created_at: string;
}

export class RoundAllocationsRepository {
  replaceForRound(roundId: string, allocations: Array<Omit<RoundAllocationRecord, 'id' | 'created_at' | 'round_id'>>): void {
    const db = getDb();
    db.prepare('DELETE FROM round_allocations WHERE round_id = ?').run(roundId);
    const insert = db.prepare(`
      INSERT INTO round_allocations (
        id, round_id, creator_id, payout_address, payout_family, payout_network, payout_token,
        direct_tips, match_amount, score, unique_tippers, settlement_mode, tx_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction(() => {
      for (const allocation of allocations) {
        insert.run(
          uuidv4().replace(/-/g, ''),
          roundId,
          allocation.creator_id,
          allocation.payout_address,
          allocation.payout_family,
          allocation.payout_network,
          allocation.payout_token,
          allocation.direct_tips,
          allocation.match_amount,
          allocation.score,
          allocation.unique_tippers,
          allocation.settlement_mode,
          allocation.tx_hash ?? null,
        );
      }
    });
    tx();
  }

  listByRound(roundId: string): RoundAllocationRecord[] {
    const db = getDb();
    return db.prepare('SELECT * FROM round_allocations WHERE round_id = ? ORDER BY rowid ASC').all(roundId) as RoundAllocationRecord[];
  }
}
