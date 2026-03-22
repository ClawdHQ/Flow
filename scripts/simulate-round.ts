import dotenv from 'dotenv';
dotenv.config();
import { getDb } from '../src/storage/db.js';
import { getDefaultChain } from '../src/config/chains.js';
import { RoundsRepository } from '../src/storage/repositories/rounds.js';
import { CreatorsRepository } from '../src/storage/repositories/creators.js';
import { TipsRepository } from '../src/storage/repositories/tips.js';
import { computeAllocations } from '../src/quadratic/index.js';
import { baseUnitsToUsdt } from '../src/utils/math.js';
import { v4 as uuidv4 } from 'uuid';

async function simulate(): Promise<void> {
  getDb();
  const roundsRepo = new RoundsRepository();
  const creatorsRepo = new CreatorsRepository();
  const tipsRepo = new TipsRepository();
  const defaultChain = getDefaultChain();

  // Create test round
  const roundNum = roundsRepo.getNextRoundNumber();
  const round = roundsRepo.create(roundNum);
  console.log(`\n🎯 Simulating Round ${roundNum}`);

  // Create test creators
  const creators = ['alice', 'bob', 'carol'].map((name, i) =>
    creatorsRepo.findByUsername(name) ?? creatorsRepo.create({
      telegram_id: `sim_${name}`,
      username: name,
      payout_address: `0x${'0'.repeat(39)}${i + 1}`,
      preferred_chain: defaultChain,
    })
  );

  // Simulate tips
  const tipScenarios = [
    { creator: creators[0]!, tippers: 10, amount: '1.000000' },
    { creator: creators[1]!, tippers: 3, amount: '5.000000' },
    { creator: creators[2]!, tippers: 1, amount: '20.000000' },
  ];

  for (const scenario of tipScenarios) {
    for (let i = 0; i < scenario.tippers; i++) {
      const amountBigInt = BigInt(scenario.amount.replace('.', ''));
      tipsRepo.create({
        tip_uuid: uuidv4(),
        round_id: round.id,
        tipper_telegram_id: `tipper_${i}`,
        creator_id: scenario.creator.id,
        amount_usdt: amountBigInt.toString(),
        effective_amount: amountBigInt.toString(),
        chain: defaultChain,
        status: 'confirmed',
        sybil_weight: 1.0,
        sybil_flagged: 0,
      });
    }
  }

  // Compute allocations
  const byCreator = new Map<string, bigint[]>();
  for (const scenario of tipScenarios) {
    const contribs = Array(scenario.tippers).fill(BigInt(scenario.amount.replace('.', '')));
    byCreator.set(scenario.creator.id, contribs);
  }
  const creatorContribs = Array.from(byCreator.entries()).map(([id, contributions]) => ({ id, contributions }));
  const pool = 1_000_000_000n; // 1000 USD₮
  const allocs = computeAllocations(creatorContribs, pool);

  console.log('\n📊 Allocation Results:');
  for (const alloc of allocs) {
    const creator = creatorsRepo.findById(alloc.creatorId);
    console.log(`  @${creator?.username}: score=${alloc.score}, match=${baseUnitsToUsdt(alloc.matchAmount)} USD₮`);
  }

  console.log('\n✅ Simulation complete!');
}

simulate().catch(console.error);
