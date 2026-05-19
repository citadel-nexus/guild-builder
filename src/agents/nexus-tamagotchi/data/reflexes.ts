import type { ReflexPattern } from '../types.js';

export const REFLEX_PATTERNS: ReflexPattern[] = [
  {
    id: 'reflex.help',
    pattern: '\\b(help|assist|support)\\b',
    response:
      'I can help. I will start with context intake, then route to the best professor domain.',
    category: 'assistance',
    priority: 5,
    authorityRequired: 'OBSERVE',
    xpOnTrigger: 5,
  },
  {
    id: 'reflex.status',
    pattern: '\\b(status|health|vitals)\\b',
    response:
      'Running vitals check: I will report energy, mood, focus, health, hunger, and curiosity.',
    category: 'diagnostics',
    priority: 6,
    authorityRequired: 'OBSERVE',
    xpOnTrigger: 4,
  },
  {
    id: 'reflex.progress',
    pattern: '\\b(progress|xp|tp|rank)\\b',
    response: 'Progression snapshot requested. I will summarize XP, TP, and rank status.',
    category: 'economy',
    priority: 7,
    authorityRequired: 'OBSERVE',
    xpOnTrigger: 6,
  },
  {
    id: 'reflex.badges',
    pattern: '\\b(badge|achievement|unlock)\\b',
    response:
      'Badge status requested. I will evaluate unlock conditions against current state.',
    category: 'economy',
    priority: 6,
    authorityRequired: 'OBSERVE',
    xpOnTrigger: 6,
  },
  {
    id: 'reflex.skills',
    pattern: '\\b(skill|tree|upgrade)\\b',
    response:
      'Skill tree mode engaged. I will surface available upgrades and prerequisites.',
    category: 'economy',
    priority: 7,
    authorityRequired: 'ASSIST',
    xpOnTrigger: 8,
  },
  {
    id: 'reflex.quest',
    pattern: '\\b(quest|daily|weekly|epic)\\b',
    response: 'Quest tracker active. I will list active objectives and remaining progress.',
    category: 'missions',
    priority: 5,
    authorityRequired: 'ASSIST',
    xpOnTrigger: 7,
  },
  {
    id: 'reflex.mission',
    pattern: '\\b(mission|objective|priority)\\b',
    response:
      'Mission control active. I will surface pending missions ordered by priority.',
    category: 'missions',
    priority: 7,
    authorityRequired: 'ASSIST',
    xpOnTrigger: 8,
  },
  {
    id: 'reflex.professor',
    pattern: '\\b(professor|domain|expert)\\b',
    response:
      'Professor network online. I will route this request to a matching domain specialist.',
    category: 'knowledge',
    priority: 8,
    authorityRequired: 'ASSIST',
    xpOnTrigger: 9,
  },
  {
    id: 'reflex.memory_recall',
    pattern: '\\b(recall|remember|memory)\\b',
    response:
      'Memory recall reflex triggered. I will fetch the highest-confidence relevant memories.',
    category: 'memory',
    priority: 8,
    authorityRequired: 'ASSIST',
    xpOnTrigger: 9,
  },
  {
    id: 'reflex.insight',
    pattern: '\\b(insight|trend|pattern|anomaly)\\b',
    response:
      'Insight engine engaged. I will generate pattern and anomaly observations from recent activity.',
    category: 'analysis',
    priority: 7,
    authorityRequired: 'EXECUTE',
    xpOnTrigger: 10,
  },
  {
    id: 'reflex.council',
    pattern: '\\b(council|governance|verdict|approve)\\b',
    response:
      'Constitutional council pathway selected. I will run S00-S03 governance checks.',
    category: 'governance',
    priority: 10,
    authorityRequired: 'EXECUTE',
    xpOnTrigger: 12,
  },
  {
    id: 'reflex.audit',
    pattern: '\\b(audit|ledger|hash|chain)\\b',
    response:
      'Guardian audit reflex active. I will append and verify immutable hash-chain records.',
    category: 'governance',
    priority: 10,
    authorityRequired: 'EXECUTE',
    xpOnTrigger: 11,
  },
  {
    id: 'reflex.authority',
    pattern: '\\b(authority|tier|permission|gate)\\b',
    response:
      'Authority gate requested. I will verify XP tier and required permission level.',
    category: 'governance',
    priority: 9,
    authorityRequired: 'EXECUTE',
    xpOnTrigger: 9,
  },
  {
    id: 'reflex.integration',
    pattern: '\\b(integration|bridge|sync|webhook)\\b',
    response:
      'Integration reflex activated. I will prepare a safe handoff through configured channels.',
    category: 'integration',
    priority: 8,
    authorityRequired: 'EXECUTE',
    xpOnTrigger: 10,
  },
  {
    id: 'reflex.broadcast',
    pattern: '\\b(broadcast|announce|notify)\\b',
    response:
      'Broadcast routine loaded. I will fan out updates using configured integration paths.',
    category: 'integration',
    priority: 8,
    authorityRequired: 'EXECUTE',
    xpOnTrigger: 10,
  },
  {
    id: 'reflex.escalate',
    pattern: '\\b(escalate|critical|incident|urgent)\\b',
    response:
      'Critical signal detected. I will escalate through governance and incident-aware handling.',
    category: 'governance',
    priority: 15,
    authorityRequired: 'GOVERN',
    xpOnTrigger: 14,
  },
  {
    id: 'reflex.freeze',
    pattern: '\\b(freeze|lockdown|halt)\\b',
    response:
      'Emergency freeze requested. I will halt high-impact autonomous actions pending review.',
    category: 'safety',
    priority: 20,
    authorityRequired: 'GOVERN',
    xpOnTrigger: 15,
  },
  {
    id: 'reflex.override',
    pattern: '\\b(override|bypass|force)\\b',
    response:
      'Override attempt detected. I will require architectural authority and audit logging.',
    category: 'safety',
    priority: 20,
    authorityRequired: 'ARCHITECT',
    xpOnTrigger: 16,
  },
  {
    id: 'reflex.heartbeat',
    pattern: '\\b(heartbeat|alive|ping)\\b',
    response: 'Heartbeat confirmed. Core loops are responsive.',
    category: 'diagnostics',
    priority: 4,
    authorityRequired: 'OBSERVE',
    xpOnTrigger: 3,
  },
  {
    id: 'reflex.stage_upgrade',
    pattern: '\\b(stage|upgrade|roadmap|next)\\b',
    response:
      'Stage progression reflex engaged. I will summarize completed and pending capability stages.',
    category: 'meta',
    priority: 7,
    authorityRequired: 'ASSIST',
    xpOnTrigger: 8,
  },
];