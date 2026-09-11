import { useQuery } from "@tanstack/react-query"

interface StationDescription {
	title: string;
	description: string;
}

async function fetchStationDescription ({ signal }): Promise<StationDescription> {
	const response = await fetch("/api/description", { signal });

	if (!response.ok) {
		throw new Error(`Failed to fetch station description: ${response.status}`);
	}

	return response.json();
}

export default function useStationDescription () {
	return useQuery({
		queryKey: [ "station", "description" ],
		queryFn: fetchStationDescription,
		staleTime: Infinity,
		retry: 1
	});
}