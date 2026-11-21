import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  incidentGroups,
  incidentsSchema,
  isActiveCritical,
} from '../src/features/incidents/model'

const exportPath = resolve('data/character_problems.json')
const attributesPath = resolve('data/incidents_attributes.json')

describe('official MTS materials', () => {
  it('parses the provided export and assigns independent groups', async () => {
    const incidents = incidentsSchema.parse(
      JSON.parse(await readFile(exportPath, 'utf8'))
    )
    expect(incidents).toHaveLength(44)
    const coordinators = incidents.filter(({ assignedGroupName }) =>
      assignedGroupName?.includes('Координаторы Массовых')
    )
    expect(coordinators.length).toBeGreaterThan(0)
    for (const incident of coordinators) {
      const keys = incidentGroups
        .filter(({ match }) => match(incident))
        .map(({ key }) => key)
      expect(keys.length).toBeGreaterThan(0)
    }
    expect(incidents.some(isActiveCritical)).toBe(false)
  })

  it('ships the attributes dictionary from organizers', async () => {
    const attributes = JSON.parse(await readFile(attributesPath, 'utf8'))
    const priority = attributes.find(
      (row: { api_source: string }) => row.api_source === 'priorityId'
    )
    expect(String(priority?.possible_values)).toMatch(/4/)
    expect(priority?.description).toMatch(/Наивысший-4/)
  })
})