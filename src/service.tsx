import { createEffect, createMemo, onCleanup, onMount, ParentProps } from "solid-js"
import { Hooks, IdbRecord, UnsyncedRecord, WireStoreConfig, WireStoreContext, WireStoreContextValue, WireStoreDefinition } from "./types"
import { Idb, useIdb } from "./idb"

export function WireStoreService<Definition extends WireStoreDefinition, Extention>(
	props: ParentProps<{
		namespace: string,
		config: WireStoreConfig<Definition, Extention>,
		recordTypes: (keyof Definition)[],
		periodic?: true | number,
		hooks?: Hooks[]
	}>
) {
	let context = createMemo(() => {
		let name = `wire-store:${props.config.name}:${props.namespace}`
		let context: WireStoreContextValue = {
			idb: useIdb(name, props.recordTypes, props.hooks),
			sync: triggerSync
		}
		return context
	})
	let syncing = false
	let unsubscribe: Function | undefined = undefined
	let periodicSyncInterval: any

	createEffect((prev?: Idb) => {
		if (prev) {
			prev?.internal.close()
		}
		let idb = context().idb
		unsubscribe?.()
		unsubscribe = idb.internal.listenToUnsyncedChanges(() => {
			triggerSync()
		})
		startPeriodicSync()
		return idb
	})

	function startPeriodicSync() {
		clearInterval(periodicSyncInterval)
		if (props.periodic === undefined || props.periodic === null) return
		if (props.periodic === true) {
			periodicSyncInterval = setInterval(triggerSync, 60000)
		} else if (
			typeof props.periodic === "number" &&
			!isNaN(props.periodic) &&
			props.periodic > 0
		) {
			periodicSyncInterval = setInterval(triggerSync, props.periodic)
		} else {
			console.warn(`unable to start periodic syncing: invalid interval: ${props.periodic}`)
			return
		}
	}

	onMount(() => {
		triggerSync()
	})

	onCleanup(() => {
		context().idb.internal.close()
		unsubscribe?.()
		clearInterval(periodicSyncInterval)
	})

	async function triggerSync() {
		if (syncing) return

		syncing = true
		let cursorKey = `wire-store:${props.config.name}:${props.namespace}:sync-cursor`
		let idb = context().idb.internal
		let namespace = props.namespace

		try {
			let unsynced = (await idb.getUnsynced()).map(item => {
				let record: UnsyncedRecord<Definition> = {
					id: item.id,
					type: item.type,
					state: item.deleted === true ? "deleted" : "updated",
					data: { ...item.data }
				}
				return record
			})

			let syncCursor = localStorage.getItem(cursorKey) || undefined
			let { records, syncCursor: updatedSyncCursor } = await props.config.sync(
				{ records: unsynced, namespace, syncCursor }
			)

			let updated = records
				.filter(record => record.state === "updated")
				.map<IdbRecord>(record => ({
					id: record.id,
					type: record.type,
					data: record.data,
				}))
			await idb.put(...updated)

			let deleted = records.filter(record => record.state === "deleted").map(record => record.id)
			await idb.purge(deleted)

			if (updatedSyncCursor !== undefined && updatedSyncCursor !== null) {
				localStorage.setItem(cursorKey, updatedSyncCursor)
			} else {
				localStorage.removeItem(cursorKey)
			}

		} finally {
			syncing = false
		}
	}

	return (
		<WireStoreContext.Provider value={context()} >
			{props.children}
		</WireStoreContext.Provider>
	)
}
