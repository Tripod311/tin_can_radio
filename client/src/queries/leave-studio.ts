export default async function leaveStudio () {
    const response = await fetch("/api/leaveStudio", {
        method: "POST"
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }
}