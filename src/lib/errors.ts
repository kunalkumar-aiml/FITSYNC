/** A deployment configuration problem (missing secret, unapplied migration). Shown to users as a temporary outage. */
export class ConfigError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
