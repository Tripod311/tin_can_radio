import { useQuery } from "@tanstack/react-query";

async function refreshLease () {
    const response = await fetch("/api/refreshStudio", {
        method: "POST"
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return null;
}

export default function useLeaseRefresh () {
    return useQuery({
        queryKey: [ "station", "lease" ],
        queryFn: refreshLease,
        refetchInterval: 5_000,
        retry: 1
    });
}