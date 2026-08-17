interface HeaderProps {
  title: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {description && (
        <p className="mt-1 text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
