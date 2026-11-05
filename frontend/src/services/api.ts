import { BackendHealth } from '../types';

export async function fetchBackendHealth(): Promise<BackendHealth> {
  const response = await fetch('/health', {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Health check returned status HTTP ${response.status}`);
  }

  return response.json();
}
