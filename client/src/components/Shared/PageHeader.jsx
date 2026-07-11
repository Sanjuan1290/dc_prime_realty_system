const PageHeader = (props) => {
  const Icon = props.icon
  return (
    <div className="flex items-center gap-4">
      <Icon className="h-12 w-12 shrink-0 rounded-xl border border-blue-100 bg-blue-50 p-2.5 text-blue-700" />
      <div>
        <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">{props.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{props.description}</p>
      </div>
    </div>
  )
}
export default PageHeader

