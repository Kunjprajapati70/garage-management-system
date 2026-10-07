import { useEffect, useState } from 'react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Autocomplete, TextField, type TextFieldProps } from '@mui/material'

export function Field<T extends FieldValues>({
  name,
  control,
  ...props
}: TextFieldProps & { name: Path<T>; control: Control<T> }) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...props}
          {...field}
          value={field.value ?? ''}
          fullWidth
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message || props.helperText}
        />
      )}
    />
  )
}

export interface PickOption {
  id: string
  label: string
  hint?: string
}

export function EntityPicker({
  label,
  value,
  onChange,
  load,
  error,
  disabled,
}: {
  label: string
  value: PickOption | null
  onChange: (value: PickOption | null) => void
  load: (query: string) => Promise<PickOption[]>
  error?: string
  disabled?: boolean
}) {
  const [options, setOptions] = useState<PickOption[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true)
      void load(input)
        .then(setOptions)
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(handle)
  }, [input])
  return (
    <Autocomplete
      options={options}
      value={value}
      disabled={disabled}
      loading={loading}
      onChange={(_event, next) => onChange(next)}
      onInputChange={(_event, next) => setInput(next)}
      isOptionEqualToValue={(left, right) => left.id === right.id}
      getOptionLabel={(option) => option.label}
      renderInput={(params) => <TextField {...params} label={label} error={Boolean(error)} helperText={error} />}
    />
  )
}
