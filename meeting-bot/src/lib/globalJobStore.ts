import { JobStore } from './JobStore';
import config from '../config';

// Create a global job store instance with configured concurrency capacity
export const globalJobStore = new JobStore(config.maxConcurrentJobs);

// Utility functions for easier access
export const isShutdownRequested = (): boolean => globalJobStore.isShutdownRequested();
export const isJobStoreBusy = (): boolean => globalJobStore.isBusy();
export const getActiveJobCount = (): number => globalJobStore.getActiveJobCount();
export const getMaxConcurrentJobs = (): number => globalJobStore.getMaxConcurrentJobs();
export const getCapacityInfo = () => globalJobStore.getCapacityInfo();