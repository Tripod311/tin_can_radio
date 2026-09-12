export default async function enterStudio(password: string): Promise<void> {
	const response = await fetch("/api/enterStudio", {
		method: "POST",
		headers: {
			"Content-Type": "text/plain",
		},
		body: password,
	})

	if (!response.ok) {
		throw new Error(await response.text())
	}
}