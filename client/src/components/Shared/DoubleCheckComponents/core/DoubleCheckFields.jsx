import DoubleCheckField from './DoubleCheckField'

const DoubleCheckFields = ({ fields = [], columns = 2 }) => (
  <div className={`grid gap-2 ${columns === 1 ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
    {fields.map((field, index) => (
      <DoubleCheckField key={field.key || `${field.label}-${index}`} {...field} />
    ))}
  </div>
)

export default DoubleCheckFields

