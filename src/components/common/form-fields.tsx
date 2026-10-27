import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'

import { useCodes, useShippers } from '@/features/master/api'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

type BaseProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  required?: boolean
  description?: string
  disabled?: boolean
}

function Label({
  label,
  required,
  htmlFor,
}: {
  label: string
  required?: boolean
  htmlFor: string
}) {
  return (
    <FieldLabel htmlFor={htmlFor}>
      {label}
      {required && <span className="text-destructive">*</span>}
    </FieldLabel>
  )
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  description,
  disabled,
  type = 'text',
  placeholder,
}: BaseProps<T> & {
  type?: 'text' | 'email' | 'tel' | 'number' | 'password' | 'date'
  placeholder?: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <Label label={label} required={required} htmlFor={name} />
          <Input
            id={name}
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            {...field}
            value={field.value ?? ''}
            onChange={(e) =>
              field.onChange(
                type === 'number'
                  ? e.target.value === ''
                    ? null
                    : Number(e.target.value)
                  : e.target.value,
              )
            }
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  disabled,
}: BaseProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <Label label={label} required={required} htmlFor={name} />
          <Textarea id={name} rows={3} disabled={disabled} {...field} value={field.value ?? ''} />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
}: BaseProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" className="justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            {description && <FieldDescription>{description}</FieldDescription>}
          </div>
          <Switch
            id={name}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            disabled={disabled}
          />
        </Field>
      )}
    />
  )
}

type Option = { value: string; label: string }

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  description,
  disabled,
  options,
  placeholder = '선택',
  allowEmpty,
}: BaseProps<T> & { options: Option[]; placeholder?: string; allowEmpty?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <Label label={label} required={required} htmlFor={name} />
          <Select
            value={field.value ?? ''}
            onValueChange={(v) => field.onChange(v === '__none' ? null : v)}
            disabled={disabled}
          >
            <SelectTrigger id={name} aria-invalid={fieldState.invalid} className="w-full">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {allowEmpty && <SelectItem value="__none">(선택 안 함)</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

// 공통코드 선택
export function CodeSelectField<T extends FieldValues>(
  props: BaseProps<T> & { group: string; allowEmpty?: boolean },
) {
  const { data } = useCodes(props.group)
  const options = (data ?? [])
    .filter((c) => c.is_active)
    .map((c) => ({ value: c.code, label: `${c.code_name} (${c.code})` }))
  return <SelectField {...props} options={options} />
}

// 화주사 선택
export function ShipperSelectField<T extends FieldValues>(
  props: BaseProps<T> & { activeOnly?: boolean },
) {
  const { data } = useShippers()
  const options = (data ?? [])
    .filter((s) => !props.activeOnly || s.is_active)
    .map((s) => ({ value: s.id, label: `${s.shipper_name} (${s.shipper_code})` }))
  return <SelectField {...props} options={options} />
}
