import { logger } from '@/lib/logging/pii-filter';

/**
 * Track auth latency metrics
 */
export async function trackAuthLatency(
  operation: string,
  startTime: number,
  region: string
): Promise<void> {
  const latency = Date.now() - startTime;

  // Log to console (replace with proper monitoring service)
  logger.info('auth_latency', {
    operation,
    latency,
    region,
    timestamp: new Date().toISOString(),
  });

  // Send to monitoring service (e.g., Datadog, New Relic)
  if (process.env.MONITORING_ENABLED === 'true') {
    // await sendToMonitoring({
    //   metric: 'auth.latency',
    //   value: latency,
    //   tags: { operation, region },
    // });
  }

  // Alert if latency exceeds threshold
  if (latency > 250) {
    logger.warn('Auth latency exceeded 250ms threshold', {
      operation,
      latency,
      region,
    });
  }
}

/**
 * Track plan list load time
 */
export async function trackPlanListLatency(
  startTime: number,
  planCount: number
): Promise<void> {
  const latency = Date.now() - startTime;

  logger.info('plan_list_latency', {
    latency,
    planCount,
    timestamp: new Date().toISOString(),
  });

  // Alert if latency exceeds 1 second
  if (latency > 1000) {
    logger.warn('Plan list load exceeded 1s threshold', {
      latency,
      planCount,
    });
  }
}

/**
 * Track onboarding step save latency
 */
export async function trackOnboardingLatency(
  step: number,
  startTime: number
): Promise<void> {
  const latency = Date.now() - startTime;

  logger.info('onboarding_step_latency', {
    step,
    latency,
    timestamp: new Date().toISOString(),
  });

  // Alert if latency exceeds 500ms
  if (latency > 500) {
    logger.warn('Onboarding step save exceeded 500ms threshold', {
      step,
      latency,
    });
  }
}

/**
 * Create a performance timer for measuring operations
 */
export function createTimer(): { getElapsed: () => number; startTime: number } {
  const startTime = Date.now();
  return {
    startTime,
    getElapsed: () => Date.now() - startTime,
  };
}
