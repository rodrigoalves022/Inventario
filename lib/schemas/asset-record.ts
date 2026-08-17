import { z } from 'zod'

/**
 * Patrimonio e' preenchimento manual — nunca chega pelo agente. Datas vem do
 * formulario como string "yyyy-mm-dd" (input type=date) e strings vazias
 * viram null, nao erro de validacao: todo campo aqui e opcional.
 */
const emptyToNull = (value: unknown) => (value === '' ? null : value)

export const assetRecordSchema = z.object({
  etiqueta: z.preprocess(emptyToNull, z.string().max(100).nullable().optional()),
  dataCompra: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  notaFiscal: z.preprocess(emptyToNull, z.string().max(100).nullable().optional()),
  fornecedor: z.preprocess(emptyToNull, z.string().max(255).nullable().optional()),
  valor: z.preprocess(emptyToNull, z.coerce.number().min(0).max(100_000_000).nullable().optional()),
  garantiaAte: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  centroCusto: z.preprocess(emptyToNull, z.string().max(100).nullable().optional()),
  localizacao: z.preprocess(emptyToNull, z.string().max(255).nullable().optional()),
  responsavel: z.preprocess(emptyToNull, z.string().max(255).nullable().optional()),
  observacoes: z.preprocess(emptyToNull, z.string().max(2000).nullable().optional()),
})

export type AssetRecordInput = z.infer<typeof assetRecordSchema>
