import { z } from 'zod'

/**
 * Patrimonio e' preenchimento manual — nunca chega pelo agente. Datas vem do
 * formulario como string "yyyy-mm-dd" (input type=date) e strings vazias
 * viram null, nao erro de validacao: todo campo aqui e opcional.
 */
const emptyToNull = (value: unknown) => (value === '' ? null : value)

const shortText = (label: string) =>
  z.string().max(100, `${label}: máximo de 100 caracteres.`).nullable().optional()
const longText = (label: string) =>
  z.string().max(255, `${label}: máximo de 255 caracteres.`).nullable().optional()

export const assetRecordSchema = z.object({
  etiqueta: z.preprocess(emptyToNull, shortText('Etiqueta de patrimônio')),
  dataCompra: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  notaFiscal: z.preprocess(emptyToNull, shortText('Nota fiscal')),
  fornecedor: z.preprocess(emptyToNull, longText('Fornecedor')),
  valor: z.preprocess(
    emptyToNull,
    z.coerce
      .number()
      .min(0, 'Valor não pode ser negativo.')
      .max(100_000_000, 'Valor acima do limite permitido.')
      .nullable()
      .optional()
  ),
  garantiaAte: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
  centroCusto: z.preprocess(emptyToNull, shortText('Centro de custo')),
  localizacao: z.preprocess(emptyToNull, longText('Localização')),
  responsavel: z.preprocess(emptyToNull, longText('Responsável')),
  observacoes: z.preprocess(emptyToNull, z.string().max(2000, 'Observações: máximo de 2.000 caracteres.').nullable().optional()),
})

export type AssetRecordInput = z.infer<typeof assetRecordSchema>
