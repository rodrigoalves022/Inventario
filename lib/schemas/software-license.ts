import { z } from 'zod'

export const softwareLicenseInputSchema = z.object({
  id: z.string().trim().optional(),
  softwareName: z.string().trim().min(1, 'Nome do software é obrigatório').max(150),
  licenseKey: z.string().trim().max(255).optional().nullable(),
  seatsPurchased: z.coerce.number().int().min(1, 'Mínimo de 1 licença comprada').max(100000),
  contractRef: z.string().trim().max(100).optional().nullable(),
  supplier: z.string().trim().max(100).optional().nullable(),
  cost: z.coerce.number().min(0, 'Valor não pode ser negativo').optional().nullable(),
  expiresAt: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export type SoftwareLicenseInput = z.infer<typeof softwareLicenseInputSchema>
