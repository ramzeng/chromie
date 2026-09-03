export type StorageLocation = {
  path: string
  isDefault: boolean
}

export type StorageLocationChangeResult = {
  changed: boolean
  location: StorageLocation
}
