interface CabecalhoProps {
  title: string
  description?: string
}

export function Cabecalho({ title, description }: CabecalhoProps) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight text-fg-strong">{title}</h1>
      {description && (
        <p className="mt-1 text-fg-muted">{description}</p>
      )}
    </div>
  )
}
