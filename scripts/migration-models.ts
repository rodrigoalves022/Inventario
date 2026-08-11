/**
 * Ordem de dependencia de FK: cada model so aparece depois daqueles que ele referencia.
 * Usada tanto no export quanto no import — no import a ordem importa, senao o insert
 * viola foreign key (ex.: `user.clientId` exige que `client` ja exista).
 */
export const MIGRATION_MODELS = [
  'client',
  'user',
  'agentAuth',
  'device',
  'hardware',
  'network',
  'disk',
  'software',
  'collectionLog',
  'agentCheckLog',
  'agentCommand',
  'auditLog',
] as const

export type MigrationModel = (typeof MIGRATION_MODELS)[number]
