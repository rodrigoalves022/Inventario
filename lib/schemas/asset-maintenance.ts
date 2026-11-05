import { z } from 'zod'

const emptyToNull = (value: unknown) => (value === '' || value === null || value === undefined ? null : value)

export const assetMaintenanceInputSchema = z.object({
  type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'UPGRADE'], {
    errorMap: () => ({ message: 'Tipo deve ser PREVENTIVE, CORRECTIVE ou UPGRADE.' }),
  }),
  title: z
    .string({ required_error: 'Título da intervenção é obrigatório.' })
    .trim()
    .min(1, 'Título da intervenção é obrigatório.')
    .max(150, 'Título: máximo de 150 caracteres.'),
  description: z.preprocess(emptyToNull, z.string().max(2000, 'Descrição: máximo de 2.000 caracteres.').nullable().optional()),
  cost: z.preprocess(
    emptyToNull,
    z.coerce
      .number()
      .min(0, 'Custo não pode ser negativo.')
      .max(10_000_000, 'Custo acima do limite permitido.')
      .nullable()
      .optional()
  ),
  performedBy: z.preprocess(
    emptyToNull,
    z.string().max(100, 'Responsável/Técnico: máximo de 100 caracteres.').nullable().optional()
  ),
  startDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  completedDate: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  status: z
    .enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
      errorMap: () => ({ message: 'Status inválido.' }),
    })
    .default('COMPLETED'),
})

export type AssetMaintenanceInput = z.infer<typeof assetMaintenanceInputSchema>
