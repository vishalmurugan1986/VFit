import { describe, expect, it } from 'vitest'
import { BACKUP_TABLES } from './backupFormat'
import { FitnessDB } from './db'

describe('backups', () => {
  it('include every table in the database, so nothing you log is left out', () => {
    const names = new FitnessDB().tables.map((t) => t.name)
    expect([...BACKUP_TABLES].sort()).toEqual([...names].sort())
  })
})
