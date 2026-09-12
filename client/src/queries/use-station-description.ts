import { useQuery } from "@tanstack/react-query"

interface StationDescription {
	title: string;
	description: string;
}

async function fetchStationDescription ({ signal }: { signal: AbortSignal }): Promise<StationDescription> {
	const response = await fetch("/api/description", { signal });

	if (!response.ok) {
		throw new Error(`Failed to fetch station description: ${response.status}`);
	}

	const result = await response.json();

	document.title = result.title;

	return result;
}

export default function useStationDescription () {
	return useQuery({
		queryKey: [ "station", "description" ],
		queryFn: fetchStationDescription,
		staleTime: Infinity,
		retry: 1
	});
}