import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import useLeaseRefresh from "./queries/use-lease-refresh.js"
import leaveStudio from "./queries/leave-studio.js"
import useBroadcastRTC from "../hooks/useBroadcastRTC.js";

import Dialog,{type DialogOptions} from "../common/dialog.jsx"
import MediaList from "./mediaList.js";

interface BroadcastPageProps {
	onLeave: () => void;
}

export default function BroadcastPage ({
	onLeave
}: BroadcastPageProps) {
	const [ dialog, setDialog ] = useState<DialogOptions | null>(null);
	const [ micTrack, setMicTrack ] = useState<MediaStreamTrack | null>(null);
	const [ track, setTrack ] = useState<MediaStreamTrack | null>(null);
	const {
		status,
		error,
		broadcasting,
		connecting,
		start,
		stop
	 } = useBroadcastRTC(track);

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

				setMicTrack(stream.getAudioTracks()[0] ?? null)
				setTrack(stream.getAudioTracks()[0] ?? null);

				start();
				break;
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

						<div className="mt-auto">
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
								onClick={ toggleBroadcast }
							>
								{ broadcasting ? "On air" : "Capture microphone" }
							</button>
						</div>
					</form>
				</div>
			</main>

			<Dialog data={dialog} />
		</div>
	);
}