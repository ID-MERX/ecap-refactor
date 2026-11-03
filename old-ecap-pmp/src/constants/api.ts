import { generateMockTrainingLog } from "./mockData";
import type { TrainingLog } from "./types";

/**
 * True while the page is running on fake data. The page shows a "Test data"
 * badge when this is set so nobody mistakes the numbers for real ones.
 */
export const TRAINING_LOG_IS_MOCK = true;

/**
 * Loads the full training log.
 *
 * To switch to the real backend once the table exists:
 *   1. Export `dqaGet` from src/lib/api.ts (it's module-private today), or add
 *      a `getTrainingLog` there following the pattern of the other functions.
 *   2. Replace the body below with something like:
 *        const data = await dqaGet(`/training/log${fyQs(fy)}`);
 *        return { trainings: data.trainings ?? [], participants: data.participants ?? [] };
 *   3. Set TRAINING_LOG_IS_MOCK to false and delete mockData.ts.
 *
 * The endpoint should return `{ trainings: Training[], participants:
 * TrainingParticipant[] }` — see types.ts for the field-by-field mapping to
 * the paper form.
 */
export const getTrainingLog = async (): Promise<TrainingLog> => {
  // Small delay so loading states are visible while testing.
  await new Promise((resolve) => setTimeout(resolve, 300));
  return generateMockTrainingLog();
};
