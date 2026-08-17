import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ConnectionConfig } from '@/types'
import { mockConnection } from '@/lib/mockData'

const connectionSchema = z.object({
  name: z.string().min(1, 'Informe o nome da conexão'),
  host: z.string().min(1, 'Informe o host'),
  port: z.coerce.number().min(1).max(65535),
  database: z.string().min(1, 'Informe o banco de dados'),
  user: z.string().min(1, 'Informe o usuário'),
  password: z.string(),
})

type ConnectionFormData = z.infer<typeof connectionSchema>

interface ConnectionFormProps {
  onSubmit: (data: ConnectionConfig) => void
  onTestConnection: (data: ConnectionConfig) => void
  isTesting?: boolean
  defaultValues?: Partial<ConnectionConfig>
}

export function ConnectionForm({
  onSubmit,
  onTestConnection,
  isTesting = false,
  defaultValues,
}: ConnectionFormProps) {
  const [showPassword, setShowPassword] = useState(true)
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isValid },
  } = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      name: defaultValues?.name ?? mockConnection.name,
      host: defaultValues?.host ?? mockConnection.host,
      port: defaultValues?.port ?? mockConnection.port,
      database: defaultValues?.database ?? mockConnection.database,
      user: defaultValues?.user ?? mockConnection.user,
      password: defaultValues?.password ?? mockConnection.password,
    },
    mode: 'onChange',
  })

  const handleTest = () => {
    const values = getValues()
    onTestConnection(values)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conectar ao MySQL</CardTitle>
        <CardDescription>
          Informe os dados do banco onde deseja realizar a importação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Nome da conexão</Label>
              <Input id="name" placeholder="Farmácia São João" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input id="host" placeholder="192.168.0.100" {...register('host')} />
              {errors.host && <p className="text-sm text-destructive">{errors.host.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">Porta</Label>
              <Input id="port" type="number" placeholder="3306" {...register('port')} />
              {errors.port && <p className="text-sm text-destructive">{errors.port.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="database">Banco de dados</Label>
              <Input id="database" placeholder="toolspharma" {...register('database')} />
              {errors.database && <p className="text-sm text-destructive">{errors.database.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="user">Usuário</Label>
              <Input id="user" placeholder="root" {...register('user')} />
              {errors.user && <p className="text-sm text-destructive">{errors.user.message}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="off"
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting}>
              {isTesting && <Loader2 className="h-4 w-4 animate-spin" />}
              Testar conexão
            </Button>
            <Button type="submit" disabled={!isValid}>
              Continuar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
