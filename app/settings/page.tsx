'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Save, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sidebar, Header } from '@/components/sidebar'
import { cn } from '@/lib/utils'
import { getPermissionUser } from '@/lib/permissions'

export default function SettingsPageClient() {
  const { data: session } = useSession()
  const userRole = getPermissionUser(session?.user).role
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState({
    systemName: 'Sistema de Inventário TI',
    refreshInterval: '5',
    emailNotifications: true,
    alertsEnabled: true,
  })

  const [users, setUsers] = useState([
    { id: '1', name: 'Admin', email: 'admin@company.com', role: 'Admin' },
    { id: '2', name: 'João Silva', email: 'joao@company.com', role: 'Editor' },
    { id: '3', name: 'Maria Santos', email: 'maria@company.com', role: 'Visualizador' },
  ])

  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Visualizador' })

  const tabs = [
    { id: 'general', label: 'Geral' },
    { id: 'notifications', label: 'Notificações' },
    { id: 'users', label: 'Usuários' },
    { id: 'security', label: 'Segurança' },
    { id: 'about', label: 'Sobre' },
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={userRole} />
      <div className="flex-1 pl-64">
        <Header />
        <main className="p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
              <p className="text-muted-foreground">Gerencie o sistema e permissões</p>
            </div>

            <div className="flex gap-6">
              <div className="w-48 space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1">
                {activeTab === 'general' && (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-border bg-card p-6 space-y-6">
                      <h2 className="text-lg font-semibold text-foreground">Configurações Gerais</h2>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Nome do Sistema</label>
                        <Input
                          value={settings.systemName}
                          onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                          placeholder="Ex: Sistema de Inventário TI"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Intervalo de Atualização (minutos)</label>
                        <Input
                          type="number"
                          value={settings.refreshInterval}
                          onChange={(e) => setSettings({ ...settings, refreshInterval: e.target.value })}
                          placeholder="5"
                        />
                      </div>
                      <div className="space-y-4 pt-4 border-t border-border">
                        <h3 className="text-sm font-semibold text-foreground">Ativar Funcionalidades</h3>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.emailNotifications}
                            onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                            className="w-4 h-4 rounded border-border bg-card cursor-pointer"
                          />
                          <span className="text-sm text-foreground">Notificações por Email</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.alertsEnabled}
                            onChange={(e) => setSettings({ ...settings, alertsEnabled: e.target.checked })}
                            className="w-4 h-4 rounded border-border bg-card cursor-pointer"
                          />
                          <span className="text-sm text-foreground">Alertas do Sistema</span>
                        </label>
                      </div>
                      <div className="flex gap-2 pt-4 border-t border-border">
                        <Button className="gap-2">
                          <Save className="h-4 w-4" />
                          Salvar Configurações
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="rounded-lg border border-border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-foreground">Configurações de Notificações</h2>
                    <div className="space-y-4">
                      {[
                        { label: 'Máquina offline', checked: true },
                        { label: 'Disco cheio', checked: true },
                        { label: 'Atualização de sistema disponível', checked: false },
                        { label: 'Novo ativo adicionado', checked: true },
                        { label: 'Ativo removido', checked: false },
                      ].map((item, index) => (
                        <label key={index} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            defaultChecked={item.checked}
                            className="w-4 h-4 rounded border-border bg-card cursor-pointer"
                          />
                          <span className="text-sm text-foreground">{item.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-4 border-t border-border">
                      <Button className="gap-2">
                        <Save className="h-4 w-4" />
                        Salvar Preferências
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                      <h2 className="text-lg font-semibold text-foreground">Gerenciar Usuários</h2>
                      <div className="border-t border-border pt-4 space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">Adicionar Novo Usuário</h3>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Input
                            placeholder="Nome completo"
                            value={newUser.name}
                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          />
                          <Input
                            type="email"
                            placeholder="Email"
                            value={newUser.email}
                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          />
                          <select
                            value={newUser.role}
                            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                            className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
                          >
                            <option value="Visualizador">Visualizador</option>
                            <option value="Editor">Editor</option>
                            <option value="Admin">Admin</option>
                          </select>
                        </div>
                        <Button className="gap-2">
                          <Plus className="h-4 w-4" />
                          Adicionar Usuário
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-card overflow-hidden">
                      <div className="p-6 border-b border-border">
                        <h3 className="font-semibold text-foreground">Usuários Cadastrados</h3>
                      </div>
                      <div className="divide-y divide-border">
                        {users.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {user.role}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="rounded-lg border border-border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-foreground">Segurança</h2>
                    <div className="space-y-4">
                      <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-foreground">Mudar Senha</h3>
                        <div className="space-y-3">
                          <Input type="password" placeholder="Senha atual" />
                          <Input type="password" placeholder="Nova senha" />
                          <Input type="password" placeholder="Confirmar nova senha" />
                        </div>
                        <Button className="gap-2">
                          <Save className="h-4 w-4" />
                          Atualizar Senha
                        </Button>
                      </div>
                      <div className="rounded-lg bg-destructive/5 border border-destructive/30 p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-destructive">Zona de Perigo</h3>
                        <p className="text-xs text-muted-foreground">Estas ações são irreversíveis. Proceda com cuidado.</p>
                        <Button variant="destructive" className="gap-2">
                          <Trash2 className="h-4 w-4" />
                          Deletar Todas as Sessões Ativas
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'about' && (
                  <div className="rounded-lg border border-border bg-card p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-foreground">Sobre o Sistema</h2>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Versão</p>
                        <p className="text-sm font-medium text-foreground">1.0.0</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Última atualização</p>
                        <p className="text-sm font-medium text-foreground">18 de março de 2026</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Desenvolvido por</p>
                        <p className="text-sm font-medium text-foreground">v0 - Vercel AI</p>
                      </div>
                      <div className="pt-4 border-t border-border space-y-2">
                        <p className="text-xs text-muted-foreground">Sistema de Gerenciamento de Inventário de TI</p>
                        <p className="text-xs text-muted-foreground">
                          Um dashboard moderno para gerenciar e monitorar todos os seus ativos de TI em um único lugar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
