import { useQuery } from "@tanstack/react-query";

async function getIceServers(): Promise<RTCIceServer[]> {
	const response = await fetch("/ice-servers.json", {
		cache: "no-store"
	});

	if (!response.ok) {
		console.error(`Failed to load ICE servers: ${response.status}`)
		return [];
	}

	const data: unknown = await response.json();

	if (!Array.isArray(data)) {
		console.error("Invalid ICE server configuration");
		return [];
	}

	return data as RTCIceServer[];
}

export default function useIceServers() {
	return useQuery({
		queryKey: ["rtc", "ice-servers"],
		queryFn: getIceServers,
		staleTime: Infinity,
		retry: 1
	});
}