import { batch, createEffect, createSignal, Signal, untrack } from "solid-js"
import { Hooks, IdbRecord, WireStoreAPI, WireStoreCache, WireStoreDefinition } from "./types"

export type Idb = ReturnType<typeof useIdb>


export function useIdb<Definition extends WireStoreDefinition>(
	name: string,
	recordTypes: (keyof Definition)[],
	hooks?: Hooks[]
) {
	type Type = keyof Definition & string
	let db: IDBDatabase | undefined
	let subscribers: { [id: string]: Function } = {}

	let tracker = {} as Record<keyof Definition, Signal<string>>
	for (let type of recordTypes) {
		tracker[type] = createSignal("")
	}

	let cacheEnabled = false
	let cache = {} as WireStoreCache<Definition>
	for (let rawType of recordTypes) {
		let type = rawType as Type
		let api = publicApi(type)
		let [get, set] = createSignal<Definition[Type][]>([])
		createEffect(async () => {
			tracker[type][0]()
			if (cacheEnabled) {
				let records = await api.all()
				set(records)
			}
		})
		cache[type] = get
	}

	let notify = (type: string) => {
		if (type in tracker) {
			untrack(() => {
				let random = new Date().getTime().toString() + Math.random().toString(36).substring(2, 10)
				let setSignal = tracker[type][1]
				setSignal(random)
			})
		} else {
			console.warn(`attempt to notify changes for an unknown type ${type}`)
		}
	}

	function listenToUnsyncedChanges(callback: Function) {
		let id = new Date().getTime().toString()
		subscribers[id] = callback
		return () => {
			delete subscribers[id]
		}
	}

	function notifyUnsyncedChanges() {
		setTimeout(() => {
			for (let sub of Object.values(subscribers)) {
				try {
					sub()
				} catch (e) {
					console.error("idb: subscriber threw an exception: ", e)
				}
			}
		}, 1)
	}

	async function callHooks(stage: "beforeRead" | "beforeSave", record: IdbRecord) {
		if (!hooks || !record || record?.deleted) return
		await Promise.all(
			hooks
				.filter(hook => typeof hook[stage] === "function")
				.map(hook => hook[stage]!(record.type, record.data))
		)
	}

	async function getRawUnhookedRecord(id: string): Promise<IdbRecord | undefined> {
		return new Promise<IdbRecord>(async (resolve, reject) => {
			const db = await open()
			const request = db.transaction("records", "readonly").objectStore("records").get(id)
			request.onsuccess = () => {
				resolve(request.result)
			}
			request.onerror = (e: any) => {
				reject(`error when reading record '${id}: ${e.target.error}`)
			}
		})
	}

	async function purge(ids: string[]) {
		if (!ids.length) return
		const db = await open()
		let records = await Promise.all(ids.map(id => getRawUnhookedRecord(id)))
		let recordTypes = new Set(records.filter(item => !!item).map(item => item!.type))
		await Promise.all(ids.map((id) => new Promise((resolve, reject) => {
			const request = db.transaction("records", "readwrite").objectStore("records").delete(id)
			request.onsuccess = function() {
				resolve(undefined);
			};
			request.onerror = function(event: any) {
				reject("Error deleting record: " + event.target.error);
			};
		})))
		batch(() => {
			recordTypes.forEach(type => notify(type))
		})
	}

	async function put(
		...records: IdbRecord[]
	): Promise<void> {
		if (!records.length) return
		let recordTypes = new Set(records.map(item => item.type))
		const db = await open()
		await Promise.all(
			records.map((record) => new Promise(async (resolve, reject) => {
				await callHooks("beforeSave", record)
				const request = db.transaction("records", "readwrite").objectStore("records").put(record)
				request.onsuccess = () => {
					resolve(undefined)
				}
				request.onerror = (e: any) => {
					reject(`error when updating data: ${e.target.error}`)
				}
			}))
		)
		batch(() => {
			recordTypes.forEach(type => notify(type))
		})
	}

	async function getRawUnhookedUnsyncedRecords(): Promise<IdbRecord[]> {
		const db = await open()
		return new Promise<IdbRecord[]>(async (resolve, reject) => {
			const request = db.transaction("records", "readonly").objectStore("records").index("unsynced").getAll("true")
			request.onsuccess = () => {
				let items: Array<IdbRecord> = request.result
				resolve(items)
			}
			request.onerror = (e: any) => {
				reject("error when reading records: " + e.target.error)
			}
		})
	}

	function close() {
		db?.close()
	}

	function open() {
		return new Promise<IDBDatabase>((resolve, reject) => {
			if (db) {
				resolve(db)
				return
			}
			const open = indexedDB.open(name, 1)
			open.onsuccess = () => {
				db = open.result
				resolve(open.result)
			}
			open.onerror = (e: any) => {
				reject("error when opening the database: " + e.target.error)
				db = undefined
			}
			open.onupgradeneeded = (e: IDBVersionChangeEvent) => {
				const target = e.target as any
				const openedDb = (target as any).result as IDBDatabase
				openedDb.onerror = () => {
					reject("error when setting up the database: " + target.error)
					db = undefined
				}
				let store = openedDb.createObjectStore("records", { keyPath: "id" })
				store.createIndex("unsynced", "unsynced", { unique: false })
				store.createIndex("type", "type", { unique: false })
			}
			open.onblocked = () => {
				reject("error when opening the database: database blocked")
				db = undefined
			}
		})
	}

	function publicApi(type: Type): WireStoreAPI<Definition, Type> {

		function createReactiveApi<T extends Function>(fn: T): T {
			let proxy = new Proxy(fn, {
				apply(target, thisArg, args) {
					tracker[type][0]()
					return Reflect.apply(target, thisArg, args);
				},
			})
			return proxy as T
		}

		async function softDelete(...ids: string[]): Promise<void> {
			if (!ids.length) return
			await Promise.all(
				ids.map(id => new Promise((resolve, reject) => {
					let record: any = {
						id,
						type,
						deleted: true,
						unsynced: "true",
						data: {}
					}
					put(record).then(resolve).catch(reject)
				}))
			)
			notifyUnsyncedChanges()
		}

		async function set(id: string, data: any): Promise<void> {
			let record: IdbRecord = {
				id,
				type,
				unsynced: "true",
				data: JSON.parse(JSON.stringify(data))
			}
			await put(record)
			notifyUnsyncedChanges()
		}

		let get = createReactiveApi(
			async <T>(id: string): Promise<T | undefined> => {
				return new Promise<T>(async (resolve, reject) => {
					const db = await open()
					const request = db.transaction("records", "readonly").objectStore("records").get(id)
					request.onsuccess = async () => {
						await callHooks("beforeRead", request.result)
						let data = request.result?.data
						if (request.result?.deleted === true) {
							data = undefined
						}
						resolve(data)
					}
					request.onerror = (e: any) => {
						reject(`error when reading record '${id}: ${e.target.error}`)
					}
				})
			}
		)

		let all = createReactiveApi(
			async (): Promise<Definition[Type][]> => {
				return new Promise<Definition[Type][]>(async (resolve, reject) => {
					const db = await open()
					const request = db.transaction("records", "readonly").objectStore("records").index("type").getAll(type)
					request.onsuccess = async () => {
						let items: Array<IdbRecord> = request.result
						let filtered = items.filter(item => item.deleted !== true)
						await Promise.all(
							filtered.map(item => callHooks("beforeRead", item))
						)
						resolve(filtered.map(item => ({ ...item.data })))
					}
					request.onerror = (e: any) => {
						reject(`error when reading records of type '${type}': ${e.target.error}`)
					}
				})
			}
		)

		return {
			delete: softDelete,
			set,
			get,
			all,
		}
	}

	return {
		public: publicApi,
		internal: {
			close,
			listenToUnsyncedChanges,
			getUnsynced: getRawUnhookedUnsyncedRecords,
			put,
			purge,
			tracker,
			cache,
			enableCache: () => (cacheEnabled = true)
		},
	}
}
