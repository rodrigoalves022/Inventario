import { Sidebar, Header } from '@/components/sidebar'

export default function UsersPage() {
  const users = [
    { id: 1, name: 'João Silva', email: 'joao@corp.local', role: 'Admin', status: 'Ativo' },
    { id: 2, name: 'Maria Santos', email: 'maria@corp.local', role: 'Gerente', status: 'Ativo' },
    { id: 3, name: 'Pedro Costa', email: 'pedro@corp.local', role: 'Usuário', status: 'Ativo' },
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 pl-64">
        <Header />
        <main className="p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
              <p className="text-muted-foreground">Gerenciar usuários do sistema</p>
            </div>

            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-left font-semibold">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Função</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-secondary/30">
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.role}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                          {user.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
