import { useQuery } from "@tanstack/react-query"

interface StationStatus {
	broadcasting: boolean;
	nowPlaying?: string;
}

async function fetchStationStatus ({ signal }): Promise<StationStatus> {
	const response = await fetch("/api/status", { signal });

	if (!response.ok) {
		throw new Error(`Failed to fetch station status: ${response.status}`);
	}

	return response.json();
}

export default function useStationStatus () {
	return useQuery({
		queryKey: [ "station", "status" ],
		queryFn: fetchStationStatus,
		refetchInterval: 5_000,
		retry: 1
	});
}