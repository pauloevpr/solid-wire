import { UnsyncedRecord, UnsyncedRecordStates, WireStoreDefinition } from "./types"

export function validateRecordsMetadata<Definition extends WireStoreDefinition>(
	records: UnsyncedRecord<Definition>[],
	types: (keyof Definition & string)[]
) {
	validate.records({ records }, "records", types)
	return records as UnsyncedRecord<Definition>[]
}

const validate = {
	records<T extends object>(values: T, key: keyof T & string, acceptedTypes: string[]) {
		let input = values[key]
		if (!Array.isArray(input)) {
			throw Error(`records: is not an array`)
		}
		input.forEach((item, index) => {
			type key = keyof UnsyncedRecord<any>
			let id: key = "id"
			let state: key = "state"
			let type: key = "type"
			let data: key = "data"
			this.dictionary(
				{ [`records:${index}`]: item },
				`records:${index}`,
				[id, state, type, data]
			)
			this.string(item, id, 1)
			this.enum(item, state, UnsyncedRecordStates)
			this.enum(item, type, acceptedTypes)
			this.plainObject(item, data)
		})
	},

	enum<T extends object>(values: T, key: keyof T & string, accepted: string[]) {
		let input = `${values[key]}`
		if (!accepted.includes(input)) {
			throw new Error(`${key}: enum mismatch`)
		}
	},

	plainObject<T extends object>(values: T, key: keyof T & string) {
		let input = values[key]
		let valid = (
			typeof input === 'object' &&
			input !== null &&
			!Array.isArray(input) &&
			!(input instanceof Date) &&
			!(input instanceof Function)
		);
		if (!valid) {
			throw new Error(`${key}: expecting plain object`)
		}
	},

	dictionary<T extends object>(values: T, key: keyof T & string, acceptedKeys?: string[]) {
		this.plainObject(values, key)
		let input = values[key]
		let keys = Object.keys(input as any)
		let stringKeys = keys.every(key => typeof key === "string")
		if (!stringKeys) {
			throw new Error(`${key}: all keys must be string`)
		}
		if (acceptedKeys) {
			for (let k of keys) {
				if (!acceptedKeys.includes(k)) {
					throw new Error(`${key}: unexpected field ${k}`)
				}
			}
		}
	},

	string<T extends object>(values: T, key: keyof T & string, min?: number, max?: number) {
		let input = values[key]
		if (input === undefined || input === null || typeof input !== 'string') {
			throw new Error(`${key}: required`)
		}
		if (min !== undefined && input.length < min) {
			throw new Error(`${key}: minimum length is ${min}`)
		}
		if (max !== undefined && input.length > max) {
			throw new Error(`${key}: maximum length is ${max}`)
		}
	},
}



