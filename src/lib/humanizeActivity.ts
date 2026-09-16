import type { ActivityEvent, Workspace } from '../domain/types'
import { recordTitle } from './records'
import { readSchema, recordNumber } from './schema'

export function humanizeActivity(activity: ActivityEvent, workspace?: Workspace) {
  const record = workspace?.records.find((item) => item.id === activity.recordId)
  const title = record ? recordTitle(record, 'un registro', workspace) : null

  if (activity.type === 'status_changed') {
    const match = activity.message.match(/^(.+?) pasó a (.+)\.?$/)
    if (match) return `Marcaste a ${match[1]} como ${match[2]}`
  }

  if (activity.type === 'note_updated') {
    const match = activity.message.match(/^Se actualizó la nota de (.+)\.?$/)
    if (match) return `Dejaste una nota en ${match[1]}`
    if (title) return `Dejaste una nota en ${title}`
  }

  if (activity.type === 'record_created') {
    if (workspace && record) {
      const schema = readSchema(workspace)
      if (schema.amount && /km/i.test(schema.amount.unit ?? '')) {
        const distance = recordNumber(record, schema.amount)
        if (distance > 0) return `Registraste tu carrera de ${distance} km`
      }
    }
    if (activity.message.startsWith('Se registró ')) {
      return `Registraste ${activity.message.slice('Se registró '.length).replace(/\.$/, '')}`
    }
    const added = activity.message.match(/^Se agregó (.+)\.?$/)
    if (added) return `Registraste ${added[1]}`
    if (title) return `Registraste ${title}`
  }

  if (activity.type === 'record_updated') {
    const updated = activity.message.match(/^Se actualizó (.+)\.?$/)
    if (updated) return `Actualizaste ${updated[1]}`
    if (title) return `Actualizaste ${title}`
  }

  if (activity.type === 'record_deleted') {
    const deleted = activity.message.match(/^Se eliminó (.+)\.?$/)
    if (deleted) return `Eliminaste ${deleted[1]}`
  }

  if (activity.type === 'workspace_created') {
    const created = activity.message.match(/^Se creó el espacio (.+)\.?$/)
    if (created) return `Creaste el espacio ${created[1]}`
  }

  return activity.message
}
