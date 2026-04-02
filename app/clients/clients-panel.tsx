'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Copy, Download, KeyRound, Rocket, Terminal } from 'lucide-react'
import {
  initialProvisioningState,
  type ProvisioningActionState,
  type ProvisioningPackage,
} from './types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

type ClientRow = {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  agentCount: number
}

type ClientsPanelProps = {
  clients: ClientRow[]
  serverUrl: string
  createClientAction: (
    state: ProvisioningActionState,
    payload: FormData
  ) => Promise<ProvisioningActionState>
  rotateEnrollmentKeyAction: (
    state: ProvisioningActionState,
    payload: FormData
  ) => Promise<ProvisioningActionState>
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      <Copy className="h-4 w-4" />
      {copied ? 'Copiado' : label}
    </Button>
  )
}

function downloadScriptFile(provisioningPackage: ProvisioningPackage) {
  const content = [
    `$server = '${provisioningPackage.bootstrapUrl}'`,
    'Invoke-RestMethod -Uri $server | Invoke-Expression',
  ].join('\r\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `instalar-${provisioningPackage.clientSlug}.ps1`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function ProvisioningResult({
  result,
  serverUrl,
}: {
  result: ProvisioningActionState
  serverUrl: string
}) {
  if (!result.error && !result.package && !result.message) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Provisionamento rapido</CardTitle>
          <CardDescription>
            Crie um cliente ou emita uma nova chave para gerar um bootstrap pronto para a instalacao remota.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>O pacote gerado baixa o agente pelo site e instala o servico automaticamente.</p>
          <p>Na maquina do cliente, basta abrir o PowerShell como administrador e colar o comando.</p>
          <p>
            Servidor detectado para esse painel: <span className="font-mono text-foreground">{serverUrl}</span>
          </p>
        </CardContent>
      </Card>
    )
  }

  if (result.error) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Falha ao gerar pacote</CardTitle>
          <CardDescription>{result.error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!result.package) return null

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Provisionado</Badge>
          <CardTitle>{result.package.clientName}</CardTitle>
          <span className="font-mono text-xs text-muted-foreground">{result.package.clientSlug}</span>
        </div>
        <CardDescription>{result.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="enrollmentKey">Enrollment key</Label>
            <Textarea id="enrollmentKey" value={result.package.enrollmentKey} readOnly className="min-h-24 font-mono" />
            <div className="flex flex-wrap gap-2">
              <CopyButton value={result.package.enrollmentKey} label="Copiar chave" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bootstrapCommand">Comando de instalacao em um passo</Label>
            <Textarea
              id="bootstrapCommand"
              value={result.package.bootstrapCommand}
              readOnly
              className="min-h-24 font-mono"
            />
            <div className="flex flex-wrap gap-2">
              <CopyButton value={result.package.bootstrapCommand} label="Copiar comando" />
              <CopyButton value={result.package.bootstrapUrl} label="Copiar URL do script" />
              <Button type="button" variant="outline" size="sm" onClick={() => downloadScriptFile(result.package!)}>
                <Download className="h-4 w-4" />
                Baixar script
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="legacyCommand">Comando manual alternativo</Label>
          <Textarea id="legacyCommand" value={result.package.installCommand} readOnly className="min-h-20 font-mono" />
          <div className="flex flex-wrap gap-2">
            <CopyButton value={result.package.installCommand} label="Copiar modo manual" />
            <Button asChild variant="secondary" size="sm">
              <Link href={result.package.bootstrapUrl}>
                <Rocket className="h-4 w-4" />
                Abrir script gerado
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ClientsPanel({
  clients,
  serverUrl,
  createClientAction,
  rotateEnrollmentKeyAction,
}: ClientsPanelProps) {
  const [provisioningServerUrl, setProvisioningServerUrl] = useState(serverUrl)
  const [createState, createAction, createPending] = useActionState(
    createClientAction,
    initialProvisioningState
  )
  const [rotateState, rotateAction, rotatePending] = useActionState(
    rotateEnrollmentKeyAction,
    initialProvisioningState
  )
  const [result, setResult] = useState<ProvisioningActionState>(initialProvisioningState)

  useEffect(() => {
    if (createState.error || createState.message || createState.package) {
      setResult(createState)
    }
  }, [createState])

  useEffect(() => {
    if (rotateState.error || rotateState.message || rotateState.package) {
      setResult(rotateState)
    }
  }, [rotateState])

  const sortedClients = useMemo(
    () => [...clients].sort((left, right) => left.name.localeCompare(right.name)),
    [clients]
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Novo cliente</CardTitle>
            <CardDescription>
              Gera o tenant, a enrollment key inicial e o bootstrap de instalacao em uma unica etapa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serverUrl">URL usada nos instaladores</Label>
                <Input
                  id="serverUrl"
                  name="serverUrl"
                  value={provisioningServerUrl}
                  onChange={(event) => setProvisioningServerUrl(event.target.value)}
                  placeholder="https://inventario.suaempresa.com"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Se o agente sera instalado em outra maquina, use aqui o IP ou dominio realmente acessivel por ela.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome do cliente</Label>
                <Input id="name" name="name" placeholder="Core TI Expert" required minLength={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug do cliente</Label>
                <Input id="slug" name="slug" placeholder="core-ti-expert" />
                <p className="text-xs text-muted-foreground">
                  Se deixar em branco, o sistema gera automaticamente.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={createPending}>
                <KeyRound className="h-4 w-4" />
                {createPending ? 'Gerando pacote...' : 'Criar cliente e emitir pacote'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <ProvisioningResult result={result} serverUrl={provisioningServerUrl} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes provisionados</CardTitle>
          <CardDescription>
            Emita um novo pacote quando precisar instalar o agente em outra empresa ou revogar instaladores antigos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedClients.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum cliente cadastrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium">Slug</th>
                    <th className="px-4 py-3 text-left font-medium">Agentes</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Painel</th>
                    <th className="px-4 py-3 text-left font-medium">Criado em</th>
                    <th className="px-4 py-3 text-left font-medium">Provisionamento</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClients.map((client) => (
                    <tr key={client.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{client.name}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{client.slug}</td>
                      <td className="px-4 py-3">{client.agentCount}</td>
                      <td className="px-4 py-3">
                        <Badge variant={client.isActive ? 'default' : 'outline'}>
                          {client.isActive ? 'ativo' : 'inativo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/tenant/${client.slug}`}>
                            <ArrowUpRight className="h-4 w-4" />
                            Abrir painel
                          </Link>
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(client.createdAt))}
                      </td>
                      <td className="px-4 py-3">
                        <form action={rotateAction}>
                          <input type="hidden" name="serverUrl" value={provisioningServerUrl} />
                          <input type="hidden" name="clientId" value={client.id} />
                          <Button type="submit" size="sm" variant="outline" disabled={rotatePending}>
                            <Terminal className="h-4 w-4" />
                            {rotatePending ? 'Emitindo...' : 'Emitir novo pacote'}
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
