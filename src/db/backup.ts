import { BACKUP_APP, BACKUP_TABLES, BACKUP_VERSION, backupFileName, type BackupFile } from './backupFormat'
import { db, ensureCardioTypes, ensurePhases } from './db'
import { seedExercises } from './seed'

export async function createBackup(): Promise<BackupFile> {
  const data = {} as BackupFile['data']
  await db.transaction('r', db.tables, async () => {
    for (const t of BACKUP_TABLES) data[t] = await db.table(t).toArray()
  })
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }
}

/** Replace everything on this device with the backup's contents (all-or-nothing). */
export async function restoreBackup(b: BackupFile): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of BACKUP_TABLES) {
      await db.table(t).clear()
      if (b.data[t].length) await db.table(t).bulkPut(b.data[t])
    }
    if ((await db.exercises.count()) === 0) await db.exercises.bulkAdd(seedExercises())
    await ensureCardioTypes(db.cardioTypes, db.cardio)
    await ensurePhases((name) => db.table(name))
    // The restored data is exactly that backup, so it counts as backed up as of then.
    const exportedAt = Date.parse(b.exportedAt)
    if (Number.isFinite(exportedAt)) await db.meta.put({ key: 'lastBackupAt', value: exportedAt })
  })
}

export async function eraseAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
    await db.exercises.bulkAdd(seedExercises())
    await ensureCardioTypes(db.cardioTypes, db.cardio)
    await ensurePhases((name) => db.table(name))
  })
}

export async function markBackedUp(): Promise<void> {
  await db.meta.put({ key: 'lastBackupAt', value: Date.now() })
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function backupBlob(): Promise<{ blob: Blob; name: string }> {
  const backup = await createBackup()
  return {
    blob: new Blob([JSON.stringify(backup)], { type: 'application/json' }),
    name: backupFileName(),
  }
}

/** Build a backup and save it as a .json download. */
export async function downloadBackup(): Promise<void> {
  const { blob, name } = await backupBlob()
  downloadBlob(blob, name)
  await markBackedUp()
}
