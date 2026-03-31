import { getStrategyContextSnapshot } from './strategy-context';
import { getVisualRealityContextSnapshot } from './visual-reality-context';

export interface VisualContextSnapshot {
  strategyAvailable: boolean;
  strategyPromptText: string;
  strategySourcePath: string | null;
  realityAvailable: boolean;
  realityPromptText: string;
  realitySourcePaths: string[];
}

export function getVisualContextSnapshot(baseDir = process.cwd()): VisualContextSnapshot {
  const strategy = getStrategyContextSnapshot(baseDir);
  const reality = getVisualRealityContextSnapshot(baseDir);

  return {
    strategyAvailable: strategy.available,
    strategyPromptText: strategy.promptText,
    strategySourcePath: strategy.sourcePath,
    realityAvailable: reality.available,
    realityPromptText: reality.promptText,
    realitySourcePaths: reality.sourcePaths,
  };
}
