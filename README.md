# Solid Wire [![npm version](https://img.shields.io/npm/solid-wire.svg)](https://www.npmjs.com/packagsolid-wire)

Solid Wire is a native SolidJS library for building local-first apps with SolidJS and SolidStart. Unlike many of the alternative local-first libraries out there, Solid Wire is designed and built from the ground up specifically to work with SolidJS and SolidStart, and to take full advantage of some powerful primitives such as `createAsync` and server functions (with `use server`).

# How it works

Solid Wire stores the data locally in the browser using [indexed-db](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). The data is then synced with the server/database using a simple and powerful sync mechanism called `push-pull`. Unlike other sync mechanisms, `push-pull` uses a single API endpoint. When syncing, the client calls the `push-pull` API endpoint, sends all its pending local writes, and receives back any new updates.

Solid Wire handles all the syncing logic and indexed-db interfacing for you. What is left for you is to write the code that persists the data to your favorite database. 

# Getting Started

## Installation and Setup

Solid Wire is designed to work with SolidStart apps. To create a new SolidStart app, checkout the official [Getting Started](https://docs.solidjs.com/solid-start/getting-started) for SolidStart.

Once you have your SolidStart app in place, the first step is to disable SSR as we will be building a local-fisrt app. Edit your app.config.ts file and set `ssr` to `false`:

```ts
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
	ssr: false,
});
```

This configuration will turn your SolidStart app into an SPA (Single Page Application), which is the ideal architecture for building local-first apps. For more infomation on configuring SolidStart, check out the [official docs](https://docs.solidjs.com/solid-start/reference/config/define-config).

> **Note:** If you need to build an app that uses both SSR and local-first, you will need to break it down into two separate apps. SolidStart does not offer support for different rendering modes per route, and Solid Wire only works in non-SSR mode.

Add Solid Wire to your project:

```sh
npm install solid-wire
```

## Creating a Wire Store

Solid Wire uses the concept of Wire Store for working with your data. A Wire Store is a data store that "wires" the data that is locally stored in the browser with the data that is stored on your server/database.

Let's start by a creating a new store using the `createWireStore` function. In this example, we are creating a store for a simple Todo app `src/lib/store`.

```ts
import { createWireStore } from "solid-wire";

export const store = createWireStore({
    name: "todo-app",
})
```

## Defining the data structure

Now we need to define which type of data we are going to store. Solid Wire allows us to add one or more data types in the `definition` field. For now let's add a single type: `Todo`:


```jsx
import { createWireStore } from "solid-wire";

type Todo = { title: string, done: boolean }

export const store = createWireStore({
    name: "todo-app",
    definition: {
        todo: {} as Todo
    },
})
```

> The typecast `as Todo` in the definition allows Solid Wire to know which typescript type to use when providing code completion for todos.


## Registering the store

Solid Wire uses the popular [Provider/Use](https://docs.solidjs.com/concepts/context) pattern to make the store available in your components tree. We start by "providing" the store somewhere up in the tree. For this example, let't provide the store in the root App component (`src/app.tsx`):

```jsx
import { store } from "./lib/store";

export default function App() {
  return (
    <Router
      root={props => (
        <Suspense>
          <store.Provider>
            {props.children}
          </store.Provider>
        </Suspense>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
```

With the store available in the components tree, we can access it from any components using `store.use()`:

```jsx
import { createWireStore } from "solid-wire"
import { store } from "./lib/store";

export default function TodoList() {
  let local = store.use()
  return (
    <ul>
    </ul>
  )
}
```

## Reading data

With the store in place, we can retrieve all todos using `store.todo.all()`. Because this is an asnyc function, we are going to wrap it using Solid's `createAsync` helper so we can wait until the data is loaded before we can render the list of todos:

```jsx
/* imports ommited */

function TodoList() {
  let local = store.use()
  let todos = createAsync(() => local.todo.all(), { initialValue: [] })
  return (
    <ul>
      <For each={todos()}>
        {todo => (
          <li>{todo.title}</li>
        )}
      </For>
    </ul>
  )
}
```

> Notice how we use an empty array as `initialValue` to avoid the `todos` variable from being potentially `undefined`. Without that setting, you might need to wrap the list in either a `<Suspense>` or `<Show>` component in order to allow waiting for the data to be available.


## Writing data

### Adding/upating

Now let's deal with updating the data in our the store. Let's start by creating a form that we can use to add new todos:

```jsx
/* store setup ommited */

function TodoList() {
  let local = store.use()
  let todos = createAsync(() => local.todo.all(), { initialValue: [] })
  return (
    <div>
      <ul>
        <For each={todos()}>
          {todo => (
            <li>{todo.title}</li>
          )}
        </For>
      </ul>
      <form>
        <label for="title">New</label>
        <input id="title" name="title" required placeholder="New Todo" />
        <button>
          Add Todo
        </button>
      </form>
    </div>
  )
}
```

Now let's handle the form submission and use `local.todo.set` to save our new todo:

```jsx
/* store setup ommited */

function TodoList() {
  let local = store.use()
  let todos = createAsync(() => local.todo.all(), { initialValue: [] })

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault()
    let data = new FormData(e.target as HTMLFormElement)
    let todo: Todo = {
      id: new Date().getTime().toString(),
      title: data.get("title") as string,
      done: false,
    }
    await local.todo.set(todo.id, todo)
  }

  return (
    <div>
      <ul>
        <For each={todos()}>
          {todo => (
            <li>{todo.title}</li>
          )}
        </For>
      </ul>
      <form onSubmit={onSubmit}>
        <label for="title">New</label>
        <input id="title" name="title" required placeholder="New Todo" />
        <button>
          Add Todo
        </button>
      </form>
    </div>
  )
}
```

> Notice how we are generating the `id` for the todo item in the client. This is a requirement for implement local-first apps.

Since our Solid Wire stores are reactive, the new todo should appear in the list automatically.

### Deleting

Now let's handle deleting a todo. Let's add a delete button next to each todo. When the button is clicked, we are going to use `local.todo.delete` to remove the todo:

```jsx
/* store setup ommited */

function TodoList() {
  let local = store.use()
  let todos = createAsync(() => local.todo.all(), { initialValue: [] })

  async function onSubmit(e: SubmitEvent) {
    /* todo creation ommited */
  }

  async function remove(todo: Todo) {
    await local.todo.delete(todo.id)
  }

  return (
    <div>
      <ul>
        <For each={todos()}>
          {todo => (
            <li>
              {todo.title}
              <button onClick={() => remove(todo)}>
                Delete
              </button>
            </li>
          )}
        </For>
      </ul>
      <form onSubmit={onSubmit}>
        <label for="title">New</label>
        <input id="title" name="title" required placeholder="New Todo" />
        <button>
          Add Todo
        </button>
      </form>
    </div>
  )
}
```

Since Solid Wire stores are reactive, the todo should be removed from the list automatically.

## Basic Syncing

Up to this point, our data only exists locally in the browser. Let's go back to our store and start syncing the data with our actual database. We start by adding a `sync` function to our store:

```jsx
/* imports ommited */

const store = createWireStore({
  name: "todo-app",
  definition: {
    todo: {} as Todo
  },
  sync: async ({records, namspace, syncCursor}) => {
    "use server"
    return { records: [], syncCursor: "" }
  },
})

/* UI components ommited */
```

> Notice the `"use server"` marker we added to the start of the function. This tells SolidStart to turn this function into an API endpoint which only runs on the server. You can learn more about server functions in the [official docs](https://docs.solidjs.com/solid-start/reference/server/use-server).

The sync function is a server function that is called by Solid Wire under the hood everytime it needs to persist local changes and/or pull new changes.

For this example, let's ignore `syncCursor` and `namespace` for now and go with a very simple implementation - we will persist the changes from the client and then return the entire todo list back to the client.

```jsx
/* imports ommited */
import { db } from "./db"

const store = createWireStore({
  name: "todo-app",
  definition: {
    todo: {} as Todo
  },
  sync: async ({records}) => {
    "use server"
    let updated = records.filter(record => record.state === "updated")
    await db.saveTodos(
      updated.map(record => ({ ...record.data, id: record.id }))
    )
    let allTodos = await db.getAllTodos()
    let updates = allTodos.map(item => ({
      id: item.id,
      state: item.deleted ? "deleted" : "updated",
      type: "todo",
      data: item.data
    }))
    return { records: updates }
  },
})

/* UI components ommited */
```

Now let's update the code and account for deleted records. Solid Wire uses the concept of soft delete internally - the records are initially not removed from the local database and are marked as deleted instead. 

In this example, we will use soft delete to "remove" items from our database as well. This is a very common approach when building local-first apps. Deleted todos will have a `deleted` field added to them so we can identify them.


```jsx
/* imports ommited */
import { db } from "./db"

const store = createWireStore({
  name: "todo-app",
  definition: {
    todo: {} as Todo
  },
  sync: async ({records}) => {
    "use server"
    let updated = records.filter(record => record.state === "updated")
    let deleted = records.filter(record => record.state === "deleted")
    await db.saveTodos(
      updated.map(record => ({ ...record.data, id: record.id }))
    )
    await db.softDeleteTodos(
      deleted.map(record => record.id)
    )
    let allTodos = await db.getAllTodos()
    let updates = allTodos.map(item => ({
      id: item.id,
      state: item.deleted ? "deleted" : "updated",
      type: "todo",
      data: item.data
    }))
    return { records: updates }
  },
})

/* UI components ommited */
```

> The implementation of `db` in the examples is entirely up to you. Solid Wire is databse agnostic and has no opinions on how and where you should store your data.

# Data APIs

Solid Wire provides simple to use APIs for working with the data in your wire stores. When creating your wire store, you start by defining all the data types you want to have in your store. The resulting wire store exposes a few data APIs functions to help you interact with each data type.

Let's take the store below as example for a simple project tracking app:

```ts
type Task = { id: string, title: string, done: boolean, projectId: string }
type Project = { id: string, name: string, completed: boolean }

const store = createWireStore({
  name: "my-app",
  definition: {
    task: {} as Task,
    project: {} as Project,
  },
  /* remaining setup ommited */
})
```

With data structure above, the following data API become available in our store:

- `store.task.all`
- `store.task.get`
- `store.task.set`
- `store.task.delete`

- `store.project.get`
- `store.project.all`
- `store.project.set`
- `store.project.delete`

We will discuss each of these APIs in the next sections.

## get

The `get` API in the wire store is used to retrieve a single record of a given type by ID. If the item does not exist, the function will return `undefined`.

Because this is an async function, we need to wrap the function using `createAsync` so the records can be loaded asynchronously.

Here is an example showing how to query and display project details in a simple project tracking app. The example assumes the ID of the project comes from URL (e.g. `src/routes/projects/[id].tsx`).

```jsx
/* store setup ommited */

function ProjectPage() {
  let params = useParams()
  let local = store.use()
  let project = createAsync(() => local.project.get(params.id))
  return (
  <Show when={project()}>
    {project => (
      <h1>{project().name}</h1>
      {/* ommited */}
    )}
  </Show>
  )
}
```

One thing to note is that wire stores are reactive. This means that when using `get` wrapped in `createAsync`, the query will automatically be executed again when `params.id` change (e.g. when the user navigates to a different project page), causing the UI to automatically and conveniently update. To learn more about `createSync`, check out the [official docs](https://docs.solidjs.com/solid-router/reference/data-apis/create-async).


Another thing to note is that, because all the data we are accessing is local and it will be retrieved super fast, there is really no reason to show loading indicators or use any of the [cache functionalities](https://docs.solidjs.com/solid-router/reference/data-apis/query) of SolidStart.

## all

The `all` API in the wire store is used to retrieve all records of a given type. If no items are found, an empty list will be returned.

Because this is an async function, we need to wrap the function using `createAsync` so the records can be loaded asynchronously.

Here is an example showing how to query and display a list of projects in a simple project tracking app:

```jsx
/* store setup ommited */

function ProjectListPage() {
  let local = store.use()
  let projects = createAsync(() => local.project.all(), { initialValue: [] })
  return (
    <ul>
      <For each={projects()}>
        {project => (
          <li>{project.name}</li>
        )}
      </For>
    </ul>
  )
}
```

> Notice how we use an empty array as `initialValue` to avoid the `projects` variable from being potentially `undefined`. Without that setting, you might need to wrap the list in either a `<Suspense>` or `<Show>` component in order to allow waiting for the data to be available.

One thing to note is that wire stores are reactive. This means that when using `all` wrapped in `createAsync`, if new projects are added to the store, the list will be updated automatically. To learn more about `createSync`, check out the [official docs](https://docs.solidjs.com/solid-router/reference/data-apis/create-async).

Another thing to note is that, because all the data we are accessing is local and it will be retrieved super fast, there is really no reason to show loading indicators or use any of the [cache functionalities](https://docs.solidjs.com/solid-router/reference/data-apis/query) of SolidStart.

## set

The `set` API in the wire store is used to either create or update records of a given type by ID. This is a void function. If no exceptions are thrown, this means the write operation was successful. 

Here is an example of using the `set` API to update project details in simple project tracking app. The example assumes the ID of the project comes from URL (e.g. `src/routes/projects/[id]/edit.tsx`).

```jsx
/* store setup ommited */

function ProjectEditPage() {
  let params = useParams()
  let local = store.use()
  let project = createAsync(() => local.project.get(params.id))

  async function onSubmit(e) {
    e.preventDefault()
    let data = new FormData(e.target)
    let update = {
      ...project(),
      name: data.get("name")
    }
    await store.project.set(update.id, update)
  }

  return (
  <Show when={project()}>
    {project => (
      <form onSubmit={onSubmit}>
        <label for="name">Name</label>
        <input id="name" name="name" value={project().name} required/>
        <button>Save</button>
      </form>
    )}
  </Show>
  )
}
```

One thing to note is that wire stores are reactive. This means that when using `set` to update the record, the `get` call wrapped in `createAsync` will triggered again, causing the UI to automatically reflect the changes. To learn more about `createSync`, check out the [official docs](https://docs.solidjs.com/solid-router/reference/data-apis/create-async).

Here is another example of using the `set` API to create a new project:

```jsx
/* store setup ommited */

function ProjectCreatePage() {
  let local = store.use()

  async function onSubmit(e) {
    e.preventDefault()
    let data = new FormData(e.target)
    let project = {
      id: new Date().getTime().toString(),
      name: data.get("name"),
    }
    await store.project.set(project.id, project)
  }

  return (
  <div>
      <h1>Create Project</h1>
      <form onSubmit={onSubmit}>
        <label for="name">Name</label>
        <input id="name" name="name" required/>
        <button>Save</button>
      </form>
  </div>
  )
}
```

Notice how we are generating the `id` for the project locally in the browser. This is a requirement for implementing local-first apps. It allows records to be created without requiring a round trip to the server. It also simplifies write operations as creating and updating records become essentially the same type of operation. 


## delete

The `delete` API is used to soft-delete a given record type by ID. This is a void function. If no exceptions are thrown, this means the delete operation was successful or that the record did not exist.

Soft-delete means the record is not actually removed from the local indexed-db instance. The record is instead marked as deleted. This greatly simplifies the syncing mechanisms as there will be no need to manually track delete events separately. Solid Wire automatically filters out soft-deleted records when using `get` or `all` APIs. There is no reason for you to track that yourself.

Here is an example of deleting a project in a list in a simple project management app:


```jsx
/* store setup ommited */

function ProjectList() {
  let local = store.use()
  let projects = createAsync(() => local.project.all(), { initialValue: [] })

  async function remove(project: Project) {
    await local.project.delete(project.id)
  }

  return (
      <ul>
        <For each={projects()}>
          {project => (
            <li>
              {project.name}
              <button onClick={() => remove(project)}>
                Delete
              </button>
            </li>
          )}
        </For>
      </ul>
  )
}
```

One thing to note is that wire stores are reactive. This means that when deleting a record using `delete`, the `all` call wrapped in `createAsync` will be triggered again, causing the UI to automatically reflect the changes and remove the deleted item. To learn more about `createSync`, check out the [official docs](https://docs.solidjs.com/solid-router/reference/data-apis/create-async).

## Custom APIs

As powerful and convenient as the built-in data APIs are (`get`, `all`, `set`, `delete`), in real-world scenarios you will likely need to extend the wire store and add additional data API functions for interacting with your local database.

Solid Wire stores can be extended with new data APIs. You can add either global APIs or type-specific APIs. You achieve that by using the `extend` parameter when setting up your store.

Here is an example of adding a `completed` function to our store that can be used to retrieve completed todos in a simple todo app:

```ts
  /* other imports ommited */
import { createWireStore } from "solid-wire"

const store = createWireStore({
  name: "todo-app",
  definition: {
    todo: {} as Todo
  },
  extend: (store) => {
      let getCompleted = async() => {
        return (await store.todo.all()).filter(todo => todo.done)
      }
      return {
        todo: { // we are adding a todo-specific API
          completed: getCompleted
        }
      }
  }
  /* sync ommited */
})
```

You can now use this new data API in any of your components by calling `store.todo.completed()`. Here is an example:


```jsx
/* store setup ommited */

function CompletedTodoList() {
  let local = store.use()
  let todos = createAsync(() => local.todo.completed(), { initialValue: [] })
  return (
    <ul>
      <For each={todos()}>
        {todo => (
          <li>{todo.title}</li>
        )}
      </For>
    </ul>
  )
}
```

When extending your store with new data APIs, you are not limited to functions used for custom queries. You can add new functions for reading, writing or even both, and your functions can issue numerous other read/write operations internally. There is no restriction.

Here is an example of adding a new data API that marks all todos as completed:

```ts
  /* other imports ommited */
import { createWireStore } from "solid-wire"

const store = createWireStore({
  name: "todo-app",
  definition: {
    todo: {} as Todo
  },
  extend: (store) => {
      let completeAll = async () => {
        let all = await store.todo.all()
        await Promise.all(
          all.map(todo => store.todo.delete(todo.id))
        )
      }
      return {
        todo: {
          completeAll
        }
      }
  }
  /* sync ommited */
})
```

You can then use the new `completeAll` API in your components by calling `store.todo.completeAll()`.

**Global APIs**

The new data APIs we added so far are type-specific, meaning they sit under `store.todo.xxx`. It is also possible to add global data APIs that can sit under `store.xxx` instead. This is an elegant way to add cross concerning data APIs to your app:

Here is an example:


```ts
  /* other imports ommited */
import { createWireStore } from "solid-wire"

const store = createWireStore({
  name: "todo-app",
  definition: {
    todo: {} as Todo
  },
  extend: (store) => {
      let someTodoQuery = async () => {
        /* implementatino ommited */
      }
      let someGlobalQuery = async () => {
        /* implementatino ommited */
      }
      return {
        someGlobalQuery,
        todo: {
          someTodoQuery
        }
      }
  }
  /* sync ommited */
})
```

You can now access the new data APIs with `store.someGlobalQuery()` and `store.todo.someTodoQuery()`.


# Syncing 

Solid Wire stores the data locally in the browser using indexed-db. The data then needs to be synced with the server/database. To achieve that, Solid Wire uses a simple and powerful sync mechanism called `push-pull`. Unlike other sync mechanisms, `push-pull` uses a single API endpoint. When syncing, the client calls the `push-pull` API endpoint, sends all its pending local writes, and receives back any new updates.

Solid Wire handles most of the syncing logic and indexed-db interfacing for you. What is left for you is to write the code that persists the data to your favorite database.

You can start adding syncing logic to your store by implementing the `sync` function in the store setup:

```ts

const store = createWireStore({
  /* setup ommited */
  sync: async ({records, namspace, syncCursor}) => {
    "use server"
    return { records: [], syncCursor: "" }
  },
})

```

The first thing to notice is that you need to add the `"use server"` marker to your sync function. This allows SolidStart to turn the function into a server function that only runs on the server and can be called from the client, very much like an API endpoint.

The basic workflow for the `sync` function is:

- validate and persist all the changes made by the client to your server-side database
- determine which updates the client is missing
- return the updates back to the client

To allow this workflow, the `sync` function receives three arguments:

**records**: a list of unsynced records that have been udated in the client. Each unsynced record contains the following fields
  - `id`: the client-side generated record ID
  - `state`: the change made to the record - either `updated` or `deleted`
  - `type`: the type of the record as defined in the `definition` setting in your store
  - `data`: an object that contains the actual data your application stores for this record type

**namespace**`: an generic tag that can be used to identify which user/tenant the data being synced refers to. Learn more in [Namespacing](#namespacing).

**syncCursor**: a generic server-defined string that can be used to track how outdated the client is and therefore which updates should be returned. This can be used to implement various syncing strategies such as [using timestamps](#using-timestamp) or [using versions](#using-versions).

In the next sections, we will discuss some of the common strategies we can use to implement our syncing logic using Solid Wire. 

## Basic syncing

A basic implementation of the `sync` function involves not using any sort of strategy to track how outdated the client is, ignoring `syncCursor` altogether. This means we will return all the records back to client at every sync. 

Despite sounding inefficient, this approach can be very valid in small apps where the volume of data is low.

Here is an example of a basic syncing logic for a simple todo app. The basic worflow is:

- validate and persist the changes made to the client
- use soft delete to "remove" items from our database. This is a very common approach when building local-first apps. Deleted todos will have a `deleted` field added to them so we can track deleted items
- return all records back to the client

```jsx
/* other imports ommited */
import { db } from "./db"
import { validate } from "./validation"
import { createWireStore, validateRecordsMetadata } from "solid-wire";

const store = createWireStore({
  name: "todo-app",
  definition: {
    todo: {} as Todo
  },
  sync: async ({records}) => {
    "use server"
    records = validateRecordsMetadata(records, store.types())
    let updated = records.filter(record => record.state === "updated" && validate.todo(record.data))
    let deleted = records.filter(record => record.state === "deleted")
    await db.saveTodos(
      updated.map(record => ({ ...record.data, id: record.id }))
    )
    await db.softDeleteTodos(
      deleted.map(record => record.id)
    )
    let allTodos = await db.getAllTodos()
    let updates = allTodos.map(item => ({
      id: item.id,
      state: item.deleted ? "deleted" : "updated",
      type: "todo",
      data: item.data
    }))
    return { records: updates }
  },
})
```

The validation of the actual data is totally up to you. You can use the `validateRecordsMetadata` helper function to validate the basic fields of the unsynced records: `id`, `type`, `state`. Validating the `data` field is total up to you. Adding user-generated records to your database without validation is a high security risk.

The implementation of `db` in the examples is entirely up to you. Solid Wire is databse agnostic and has no opinions on how and where you should store your data.

## Using Timestamp

A common and effective strategy to sync local changes to your server-side database is to use timestamps. The basic idea of this strategy is that each record in your database will have a `updated_at` field/column. This field will be updated by the server everytime records are saved. The `syncCursor` in the `sync` function will carry the `updated_at` ot the last updated record across all the database tables.

When syncing for the first time:

- the client calls `sync` with an empty `syncCursor`
- the server retrieves and return all records from the database
- the server determines and uses `updated_at` of the last changed record as the `syncCursor` returned to the client
- the client saves `syncCursor` for the next sync calls

On the next sync calls:

- the client calls `sync` and sends the last recorded `syncCursor`
- server validates and persists the local changes made by the client
- the server retrieves and return only the records that have been updated since the last timestamp in the `syncCursor`
- the server determines and uses `updated_at` of the last changed record as the `syncCursor` returned to the client
- the client records the new `syncCursor` for the next sync calls

Here is an example of implementing the timestamp-based sync strategy in a simple todo app:

```ts
/* other imports ommited */
import { db } from "./db"
import { validate } from "./validation"
import { createWireStore, validateRecordsMetadata } from "solid-wire";

const store = createWireStore({
  name: "todo-app",
  definition: {
    todo: {} as Todo
  },
  sync: async ({records, syncCursor}) => {
    "use server"
    records = validateRecordsMetadata(records, store.types())
    let syncTimestamp = new Date(syncCursor || 0)
    if (isNaN(syncTimestamp.getTime())) {
      throw Error(`bad request: parsing timestamp with value '${syncTimestampRaw}' failed`)
    }
    let updated = records.filter(record => record.state === "updated" && validate.todo(record.data))
    let deleted = records.filter(record => record.state === "deleted")
    await db.saveTodos(
      updated.map(record => ({ ...record.data, id: record.id }))
    )
    await db.softDeleteTodos(
      deleted.map(record => record.id)
    )
    let updatedSince = await db.getTodosUpdatedSince(syncTimestamp)
    let synced = updatedSince.map(item => ({
      id: item.id,
      state: item.deleted ? "deleted" : "updated",
      type: "todo",
      data: item.data
    }))
    syncTimestamp = synced[0]?.updated_at || syncTimestamp
    return { 
      records: synced,
      syncCursor: syncTimestamp.toISOString()
    }
  },
})
```

One thing to notice in the example above is that, because we save the client's updates to the database before retrieving the updated records, the updates returned to the client include the same records sent by the client. This is intentional and desirable for the following reasons:

- it allows Solid Wire to purge delete records from the indexed-db instance as it processes the records with the `deleted` state which were previously only soft-deleted
- it allows you to apply any sort of server-side logic to normalize the data

As mentioned earlier, the validation of the actual data bein synced is totally up to you. You can use the `validateRecordsMetadata` helper function to validate the basic fields of the unsynced records: `id`, `type`, `state`. Validating the `data` field is total up to you. Adding user-generated records to your database without validation is a high security risk.

The implementation of `db` in the examples is entirely up to you. Solid Wire is databse agnostic and has no opinions on how and where you should store your data.


## Using versions

TODO: explain how to use `syncCursor` to implement syncing using a version-based strategy

## Periodically

By default, Solid Wire only triggers syncing in the following occasions:

- during startup (which includes when users manually refreshes the page)
- right after local writes are made (e.g. when calling `set`, `delete`)

You can optionally enable periodic syncing to allow Solid Wire to trigger syncing periodically using a configurable interval.

To enable periodic syncing, set the `periodic` props when mounting your wire store.

```jsx

// enables periodic syncing using the default interval: 60 seconds

<store.Provider periodic>
  { /* children goes here */ }
</store.Provider>
```

Alternatively, you pass a number to the `periodic` props to configure the interval in miliseconds:


```jsx

// enables periodic syncing using a custom interval: 30 seconds

<store.Provider periodic={30000}>
  { /* children goes here */ }
</store.Provider>
```

When using a custom interval, keep in mind that the shorter the interval, the bigger the load imposed on your server.

## Local-only

Even though Solid Wire is designed to provide local-first functionality for SolidStart apps, it can be used to build local-only applications. Local-only behave just like local-first apps when interacting the local-version of the databate. The difference is that in a local-only app that changes made to the local indexed-db database are never synced with a server-side database.

Local-only is very helpful for:

- prototyping
- writing offline mobile apps powered by WebView

To enable local-only mode in your wire store, use the `localOnly` helper from Solid Wire:


```ts
  /* other imports ommited */
import { createWireStore, localOnly } from "solid-wire"

const store = createWireStore({
  name: "todo-app",
  definition: {
    todo: {} as Todo
  },
  sync: localOnly(),
})
```

Alternatively, you can add a passthrough function manually:


```ts
  /* other imports ommited */
import { createWireStore, localOnly } from "solid-wire"

const store = createWireStore({
  name: "todo-app",
  definition: {
    todo: {} as Todo
  },
  sync: async () => {
    return { records: [] }
  },
})
```

**Important**: Make sure you **DO NOT add the `"use server"`** marker to this function to avoid making an unnecessary round trip to the server.



# Namespacing 

Namespacing is a key feature of Solid Wire. It allows you to store data in the browser in different indexed-db instances in order to keep data from different users/accounts separated. Without namespacing, all the data in your app would internally be store in a single indexed-db instance, meaning all the users of your site/app would interact with the same data.

Having all the data of your app stored in a single indexed-db instance might be the desired outcome, though. This is typically the case when deploying mobile apps using web technologies where the app is hosted in an isolated browser instance using WebView, and there is no authentication. The natural isolation created in this scenario is enough to allow you to avoid namespacing.

In most cases, however, you will need namespacing to assure users only interact with their data.

## How it works

When creating wire stores, namespaces are used to composed the name of the indexed-db databases under the hood. Solid Wire uses the follwing format for determining database names:

```
wire-store:${storeName}:${namespace}
```

You define the namespace to use in your app when mounting the store. You can pass it to the provider using the `namespace` props: 

```jsx
<store.Provider namespace="some-value">
  { /* children goes here */ }
</store.Provider>
```

You can then use that namespace in your `sync` function:

```ts

const store = createWireStore({
  /* setup ommited */
  sync: async ({records, namespace, syncCursor}) => {
    "use server"
    /* syncing logic goes here */
  },
})
```

## Basic example 

A typical approach for namespacing is to use the ID of the current user/account as the namespace. Here is an example on how to achieve that using a [protected](https://docs.solidjs.com/solid-start/building-your-application/routing#route-groups) SolidStart route group `src/routes/(protected).tsx`. Notice how the store is only mounted once we have a valid logged in user.

```jsx
/* imports ommited */

export default function ProtectedSection(props: RouteSectionProps) {
  let user = createAsync(getCurrentUser)
  return (
    <Show when={user()}>
      {user => (
        <store.Provider namespace={user().id}>
          {props.children}
        </store.Provider>
      )}
    </Show>
  )
}
```

With that setting, the internal indexed-db instance will be named using the format below, resulting in a different indexed-db instance for each user.

```
wire-store:${storeName}:${userId}
```

When it comes to syncing, Solid Wire will send the provided namespace everytime it calls the `sync` endpoint. This allows you to use that namespace in however way you needed in your syncing logic:

```ts

const store = createWireStore({
  /* setup ommited */
  sync: async ({records, namespace, syncCursor}) => {
    "use server"
    // getUser throws a redirect when user is not authenticated
    let user = await getUser() 
    // let's make sure we are getting the right namespace 
    if (user.id !== namespace) throw Error("bad request")

    /* syncing logic ommited */
  },
})
```

> A common question that arises from the example above is - if the namespace is the same as the user ID, why do I need an extra step to get the current user? And why do I need to check it user ID really matches the namespace? The answer is simple - for security reasons. Being a server function, the `sync` function is very much a public API endpoint, which means we should never trust the inputs coming in. The `getUser` function in the example uses [SolidStart sessions](https://docs.solidjs.com/solid-start/advanced/session#sessions) to determine the current user, which is the correct way to check if the user is authenticated.

# Auth

TBD: explain more about using namespaces to isolate indexed-db instances?

# Security 

TBD: talk about erasing the data on logout? Encryption? Importance of validation?

# Backlog

- [ ] add support for batching updates when syncing
- [ ] add a `filter` Data API for retrieving data which uses indexed-db's cursor under the hood for better performance
- [ ] add support for custom indexed-db indexes
- [ ] add support for partial syncing to avoid having to load the entire database
- [ ] write docs on real-time syncing to show how to poke Solid Wire by calling `store.sync`
- [ ] write docs on using Client View Record to optimize data size
