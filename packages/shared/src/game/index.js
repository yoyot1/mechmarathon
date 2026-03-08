export { createDeck, shuffleDeck, dealCards } from './deck.js';
export { directionDelta, rotateDirection, oppositeDirection, isInBounds, getTile, isPit, isWallBlocking, findRobotAt, findSideFeatures, findOverlays, findMatchingPortal, getElevationDamage } from './movement.js';
export { DEFAULT_BOARD, getDefaultFlags, createEmptyBoard, rotateBoard, assembleMap } from './board.js';
export {
  executeCard, moveRobot,
  processExpressConveyors, processAllConveyors, processCurrents, processGears,
  processPushers, processCrushers, processFlamers,
  processBoardLasers, processRobotLasers,
  processRadiation, processRadioactiveWaste, processRadioactiveWasteOptionDraw, processChopShop,
  processFlags, processFlagRepair, processRepairArchive, processRepairHeal,
  handleRobotDeath, executeRegister, executeRegisterSteps, checkWinCondition, updateVirtualStatus,
} from './execution.js';
export { OPTION_CARDS, createOptionDeck, shuffleOptionDeck, drawOptionCard, hasOption, removeOption, getOptionInfo } from './options.js';
