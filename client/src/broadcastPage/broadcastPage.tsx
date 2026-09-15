import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

import useLeaseRefresh from "../queries/use-lease-refresh.js"
import useStationStatus from "../queries/use-station-status.js";
import leaveStudio from "../queries/leave-studio.js"
import useBroadcastRTC from "../hooks/useBroadcastRTC.js";
import useRecorder from "../hooks/useRecorder.js";
import useAudioDestination from "../hooks/useAudioDestination.js";

import Dialog,{type DialogOptions} from "../common/dialog.jsx"
import MediaList from "./mediaList.js";

interface BroadcastPageProps {
	onLeave: () => void;
	iceServers: RTCIceServer[];
}

export default function BroadcastPage ({
	onLeave,
	iceServers
}: BroadcastPageProps) {
	const [ dialog, setDialog ] = useState<DialogOptions | null>(null);
	const [ micTrack, setMicTrack ] = useState<MediaStreamTrack | null>(null);
	const [ track, setTrack ] = useState<MediaStreamTrack | null>(null);
	
	const {
		data: stationStatus,
		isPending: stationStatusPending,
		isError: stationStatusError
	} = useStationStatus();

	const {
		status,
		error,
		broadcasting,
		connecting,
		start,
		stop,
		replaceTrack
	} = useBroadcastRTC(iceServers);

	const {
		destinationRef,
		setSource,
		clearSource
	} = useAudioDestination();

	const {
		recording,
		error: recorderError,
		start: recorderStart,
		stop: recorderStop,
		getExtension
	} = useRecorder();

	const refreshQ = useLeaseRefresh();
	const leaveStudioMutation = useMutation({
		mutationFn: leaveStudio,
		onSuccess: onLeave,
		onError: (error) => {
			setDialog({
				type: "error",
				options: {
					message: error.message,
					onClose: closeDialog
				}
			})
		}
	})

	useEffect(() => {
		return () => {
			stop()
		}
	}, []);

	useEffect(() => {
		if (track !== null) {
			if (broadcasting) {
				replaceTrack(track);
			} else {
				start(track);
			}

			if (recording) {
				setSource(track);
			}
		} else {
			stop();
		}
	}, [track]);

	async function toggleBroadcast () {
		switch (status) {
			case "broadcasting":
			case "reconnecting":
				stop();
				break;
			case "error":
			case "idle":
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true
				})

				const micTrack = stream.getAudioTracks()[0] ?? null;

				setMicTrack(micTrack);
				setTrack(micTrack);
				break;
		}
	}

	async function toggleRecorder () {
		if (recording) {
			const blob = await recorderStop();

			const ext = getExtension();

			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");

			link.href = url;
			link.style.display = "none";
			link.download = `tin_can_${(new Date()).toISOString()}.${ext}`;
			document.body.appendChild(link);
			link.click();
			link.remove();

			setTimeout(() => {
				URL.revokeObjectURL(url);
			}, 0);
		} else {
			try {
				if (track === null) throw new Error("Must capture mic first");

				setSource(track);
				recorderStart(destinationRef.current!.stream);
			} catch (err: any) {
				setDialog({
					type: "error",
					options: {
						message: err.message,
						onClose: closeDialog
					}
				})
			}
		}
	}

	function closeDialog() {
		setDialog(null);
	}

	function onFileTrack (track: MediaStreamTrack | null) {
		if (track === null) {
			setTrack(micTrack);
		} else {
			setTrack(track);
		}
	}

	return (
		<div className="relative flex w-full h-full flex-col overflow-auto">
			<header className="relative flex justify-end p-5 sm:p-8">
				<button
					type="button"
					onClick={ () => { leaveStudioMutation.mutate() } }
					className="
						rounded-full
						border border-stone-300
						bg-white/60
						px-4 py-2
						text-sm font-medium text-stone-600
						backdrop-blur
						transition
						hover:border-stone-400
						hover:bg-white
						hover:text-stone-900
						focus:outline-none
						focus:ring-2
						focus:ring-stone-400
					"
				>
					Leave studio
				</button>
			</header>

			<main className="relative flex flex-1 justify-center px-6 pb-16">
				<div
					className="
						grid w-full max-w-5xl
						gap-6
						lg:grid-cols-[minmax(0,1fr)_22rem]
					"
				>
					<MediaList title="Jingles and music" onTrack={ onFileTrack } />

					<form
						className="
							flex flex-col
							rounded-2xl
							border border-stone-200
							bg-white/70
							p-6
							shadow-sm
							backdrop-blur
						"
						onSubmit={(event) => {
							event.preventDefault();
						}}
					>
						<h2 className="text-xl font-semibold text-stone-900">
							Broadcast
						</h2>

						<div className="mt-auto flex flex-col gap-4">
							<div
								className="
									mb-4 flex items-center justify-between
									rounded-xl
									border border-stone-200
									bg-white/70
									px-4 py-3
								"
							>
								<div className="flex items-center gap-2">
									<span
										className={`
											h-2 w-2 rounded-full
											${broadcasting
												? "animate-pulse bg-orange-500"
												: "bg-stone-300"}
										`}
									></span>

									<span className="text-sm font-medium text-stone-600">
										Active listeners
									</span>
								</div>

								<span className="text-lg font-semibold text-stone-900">
									{stationStatusPending || stationStatusError
										? "—"
										: stationStatus?.listeners ?? 0}
								</span>
							</div>

							<button
								type="button"
								className="
									w-full
									rounded-xl
									bg-rose-800
									px-5 py-3
									text-sm font-semibold text-white
									shadow-sm
									transition
									hover:bg-rose-700
									focus:outline-none
									focus:ring-4
									focus:ring-rose-200
								"
								onClick={toggleRecorder}
							>
								{recording
									? "Recording"
									: "Record stream"}
							</button>

							<button
								type="button"
								className="
									w-full
									rounded-xl
									bg-rose-800
									px-5 py-3
									text-sm font-semibold text-white
									shadow-sm
									transition
									hover:bg-rose-700
									focus:outline-none
									focus:ring-4
									focus:ring-rose-200
								"
								onClick={toggleBroadcast}
							>
								{broadcasting
									? "On air"
									: "Capture microphone"}
							</button>
						</div>
					</form>
				</div>
			</main>

			<Dialog data={dialog} />
		</div>
	);
}