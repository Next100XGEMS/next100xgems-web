export function isDesignSystemAvailable(environment = process.env.NODE_ENV) {
  return environment !== "production";
}
