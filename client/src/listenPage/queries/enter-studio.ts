export default async function enterStudio(password: string): Promise<void> {
	const response = await fetch("/api/studio", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ password }),
	})

	if (!response.ok) {
		throw new Error(await response.text())
	}
}