/**
 * Subject helpers for the bot tracker.
 *
 * Subjects are env-driven so a deployment can scope the tracker to its
 * own guild prefix (or widen it to listen across all of `citadel.>`).
 *
 * Default canon (matches src/automation/nats-listener.ts shape):
 *
 *   citadel.<guild>.bot.<bot_id>.<verb>
 *
 * Examples:
 *   citadel.builder.bot.bits-ai.dispatch_received
 *   citadel.builder.bot.uso-mcp.pr_opened
 *   citadel.builder.bot.bits-codex.recurrence_swept
 *
 * Operators may also feed pre-existing event taxonomies (e.g.
 * `citadel.bits.>`) by setting BOT_TRACKER_SUBJECTS to a comma list.
 */

export type SubjectConfig = {
  prefix: string;
  patterns: string[];
};

const DEFAULT_GUILD_PREFIX = 'citadel.builder';

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return undefined;
  }
  return value;
}

export function loadSubjectConfig(env: NodeJS.ProcessEnv = process.env): SubjectConfig {
  const prefix = env.NATS_PREFIX || DEFAULT_GUILD_PREFIX;

  const explicit = env.BOT_TRACKER_SUBJECTS;
  if (explicit) {
    const patterns = explicit
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (patterns.length > 0) {
      return { prefix, patterns };
    }
  }

  return {
    prefix,
    patterns: [`${prefix}.bot.>`],
  };
}

/**
 * Extract a bot id from a subject of the form
 *   <prefix>.bot.<bot_id>.<verb>
 * Returns null when the subject does not follow the bot canon — the
 * caller is then expected to read the id from the message payload.
 */
export function parseBotIdFromSubject(subject: string, prefix: string): string | null {
  const stripped = subject.startsWith(`${prefix}.`)
    ? subject.slice(prefix.length + 1)
    : subject;

  const segments = stripped.split('.');
  if (segments.length < 3) {
    return null;
  }
  if (segments[0] !== 'bot') {
    return null;
  }
  return segments[1];
}

/**
 * Extract the action verb from a subject of the form
 *   <prefix>.bot.<bot_id>.<verb>[.<extra>...]
 * Returns null when the subject is not bot-shaped.
 */
export function parseActionFromSubject(subject: string, prefix: string): string | null {
  const stripped = subject.startsWith(`${prefix}.`)
    ? subject.slice(prefix.length + 1)
    : subject;

  const segments = stripped.split('.');
  if (segments.length < 3) {
    return null;
  }
  if (segments[0] !== 'bot') {
    return null;
  }
  return segments.slice(2).join('.');
}

/**
 * Read the readiness of the static SUBJECTS list. Used by /health-style
 * checks so operators can confirm the tracker is wired before sending
 * traffic.
 */
export function describeSubjects(config: SubjectConfig): string {
  return config.patterns.join(', ');
}
