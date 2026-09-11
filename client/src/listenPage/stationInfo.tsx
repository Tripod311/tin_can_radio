import React, { useState } from "react"

import useStationDescription from "./queries/use-station-description.js"
import useStationStatus from "./queries/use-station-status.js"

export default function StationInfo () {
	const { data } = useStationDescription();
	const {
		data: stationStatus,
		isPending: statusPending,
		isError: statusError
	} = useStationStatus();

	const [ imageError, setImageError ] = useState(false);

	function onImageError () {
		setImageError(true);
	}

	function emulateLogo (): string {
		if (!data || !data.title) return "TC";

		const trimmed = data.title.trim();

		if (trimmed.length === 0) return "TC";

		const words = trimmed.split(" ");

		let result = "";
		for (let i = 0; i < Math.min(words.length, 3); i++) {
			if (!!words[i]![0]) {
				result += words[i]![0]?.toUpperCase();
			}
		}

		return result;
	}

	function renderStationStatus () {
		if (statusPending) {
			return <>
				<span className="h-2 w-2 rounded-full bg-stone-300"></span>
				Checking station
			</>;
		}

		if (statusError) {
			return <>
				<span className="h-2 w-2 rounded-full bg-stone-300"></span>
				Status unavailable
			</>;
		}

		if (stationStatus?.broadcasting) {
			return <>
				<span
					className="h-2 w-2 animate-pulse rounded-full bg-orange-500"
				></span>
				On air
			</>;
		}

		return <>
			<span className="h-2 w-2 rounded-full bg-stone-300"></span>
			Off air
		</>;
	}

	return <React.Fragment>
		{ imageError ?
			<div
				id="station-logo"
				className="mb-8 flex h-28 w-28 items-center justify-center
					rounded-[2rem] bg-stone-900 text-3xl font-semibold
					tracking-tight text-stone-100 shadow-xl
					shadow-stone-900/15"
				aria-label="Station logo"
			>
				{ emulateLogo() }
			</div> :
			<img
				id="station-logo"
				src="/api/logo"
				onError={onImageError}
				className="mb-8 h-28 w-28 rounded-[2rem] bg-stone-900
					object-cover shadow-xl shadow-stone-900/15"
				alt="Station logo"
			/>
		}

		<h1
			id="station-name"
			className="text-4xl font-semibold tracking-tight sm:text-5xl"
		>
			{ data?.title }
		</h1>

		{ data?.description &&
			<p
				id="station-description"
				className="mt-4 max-w-md text-base leading-7 text-stone-500
					sm:text-lg"
			>
				{ data.description }
			</p>
		}

		<div
			className="mt-6 flex items-center gap-2 text-sm font-medium
				text-stone-500"
			role="status"
			aria-live="polite"
		>
			{ renderStationStatus() }
		</div>

		{ stationStatus?.broadcasting && stationStatus.nowPlaying &&
			<div className="mt-4 max-w-md">
				<div
					className="text-xs font-medium uppercase tracking-widest
						text-stone-400"
				>
					Now playing
				</div>

				<div className="mt-1 text-base font-medium text-stone-700">
					{ stationStatus.nowPlaying }
				</div>
			</div>
		}
	</React.Fragment>
}