import assert from 'node:assert/strict'
import test from 'node:test'

import { createExampleWorkspaceData } from '../src/shared/example-workspace'
import { defaultCurrencyByMarket, marketMeta, marketOrder } from '../src/shared/portfolio'

test('example workspace covers the main portfolio views without sync credentials', () => {
  const example = createExampleWorkspaceData(
    new Date('2026-09-02T08:00:00.000Z')
  )
  const positions = example.workspace.accounts.flatMap(
    (account) => account.positions
  )
  const tagIds = new Set(example.workspace.tags.map((tag) => tag.id))
  const assignedTagIds = example.workspace.accounts.flatMap((account) => [
    ...account.tagIds,
    ...account.positions.flatMap((position) => position.tagIds)
  ])

  assert.equal(example.workspace.name, '示例工作区')
  assert.equal(example.workspace.accounts.length, 4)
  assert.equal(example.workspace.tags.length, 6)
  assert.equal(positions.length, 13)
  assert.deepEqual(
    new Set(positions.map((position) => position.market)),
    new Set(['CN', 'HK', 'US', 'CC'])
  )
  assert.equal(
    assignedTagIds.every((tagId) => tagIds.has(tagId)),
    true
  )
  assert.equal(
    example.workspace.accounts.every((account) => account.sync === undefined),
    true
  )
})

test('exposes mainland OTC funds as a separate market', () => {
  assert.deepEqual(marketOrder, ['CN', 'CN_OTC', 'HK', 'US', 'CC'])
  assert.deepEqual(marketMeta.CN_OTC, {
    label: 'CN_OTC',
    shortLabel: 'CN_OTC'
  })
  assert.equal(defaultCurrencyByMarket.CN_OTC, 'CNY')
})

test('example snapshots are deterministic historical copies of the workspace', () => {
  const now = new Date('2026-09-02T08:00:00.000Z')
  const example = createExampleWorkspaceData(now)
  const currentPrices = example.workspace.accounts.flatMap((account) =>
    account.positions.map((position) => position.price)
  )

  assert.equal(example.exchangeRates.fetchedAt, now.toISOString())
  assert.deepEqual(
    example.snapshots.map((snapshot) => snapshot.createdAt),
    [
      '2026-08-03T08:00:00.000Z',
      '2026-06-04T08:00:00.000Z',
      '2026-03-06T08:00:00.000Z',
      '2025-09-02T08:00:00.000Z'
    ]
  )
  example.snapshots.forEach((snapshot) => {
    assert.equal(snapshot.workspaceId, example.workspace.id)
    assert.notEqual(snapshot.workspace, example.workspace)
    assert.equal(snapshot.exchangeRates?.fetchedAt, snapshot.createdAt)
  })
  assert.notDeepEqual(
    example.snapshots[0].workspace.accounts.flatMap((account) =>
      account.positions.map((position) => position.price)
    ),
    currentPrices
  )
})
