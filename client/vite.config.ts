import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
	root: "src",
	plugins: [tailwindcss(), react()],

	server: {
		port: 5173,

		proxy: {
			"/api": {
				target: "http://localhost:8080",
				changeOrigin: true
			}
		}
	},

	build: {
		outDir: "../../client_dist",
		emptyOutDir: true
	}
});