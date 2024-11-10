import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
	plugins: [solidPlugin()],
	build: {
		lib: {
			entry: 'src/index.ts',
			name: 'SolidWire',
			fileName: () => "index.js",
			formats: ['es']
		},
		rollupOptions: {
			external: ['solid-js']
		}
	}
})
