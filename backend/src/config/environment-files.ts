export function resolveEnvFilePaths(
  environment = process.env.NODE_ENV ?? 'development',
): string[] {
  return [
    `.env.${environment}.local`,
    `.env.${environment}`,
    '.env.local',
    '.env',
  ];
}
