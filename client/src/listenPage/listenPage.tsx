import { useQueryClient, useMutation } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import useRTC from "../hooks/useRTC.js"
import enterStudio from "./queries/enter-studio.js"

import StationInfo from "./stationInfo.jsx"
import RadioButton from "./radioButton.jsx"
import Dialog,{type DialogOptions} from "../common/dialog.jsx"

interface ListenPageProps {
	onEnter: () => void;
}

export default function ListenPage ({ onEnter }: ListenPageProps) {
	const queryClient = useQueryClient();
	const reconnectingRef = useRef(false);
	const {
		audioRef,
		status,
		error,
		listening,
		connecting,
		start,
		stop
	} = useRTC();

	const [ dialog, setDialog ] = useState<DialogOptions | null>(null);

	function toggleLive () {
		if (status === "idle" || status === "error") {
			start();
		} else {
			stop();
		}
	}

	const enterStudioMutation = useMutation({
		mutationFn: enterStudio,
		onSuccess: () => { onEnter() },
		onError: (error) => {
			setDialog({
				type: "error",
				options: {
					message: error.message,
					onClose: closeDialog
				}
			})
		}
	});

	function passwordSubmit(password: string) {
		enterStudioMutation.mutate(password);
		setDialog({ type: "spinner", options: {} });
	}

	function closeDialog() {
		setDialog(null);
	}

	useEffect(() => {
		if (reconnectingRef.current !== null && (status === "error" || status === "idle")) {
			reconnectingRef.current = true;
			return;
		}

		if (status === "connected" && reconnectingRef.current) {
			if (reconnectingRef.current !== null) {
				queryClient.invalidateQueries({
					queryKey: ["station", "description"]
				});
			}
			
			reconnectingRef.current = false;
		}
	}, [ status, queryClient ]);

	return <div className="relative flex min-h-screen flex-col overflow-hidden">
		<div
			className="pointer-events-none absolute left-1/2 top-1/2
				h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2
				rounded-full bg-amber-200/30 blur-3xl"
		></div>

		<header className="relative flex justify-end p-5 sm:p-8">
			<button
				type="button"
				className="rounded-full border border-stone-300 bg-white/60
					px-4 py-2 text-sm font-medium text-stone-600
					backdrop-blur transition
					hover:border-stone-400 hover:bg-white hover:text-stone-900
					focus:outline-none focus:ring-2 focus:ring-stone-400"
				onClick={() => {
					setDialog({
						type: "password",
						options: {
							onSubmit: passwordSubmit,
							onCancel: closeDialog
						}
					})
				}}
			>
				Enter studio
			</button>
		</header>

		<main
			className="relative flex flex-1 items-center justify-center
				px-6 pb-20"
		>
			<section className="flex w-full max-w-xl flex-col items-center text-center">
				<StationInfo />

				<RadioButton
					toggleLive={toggleLive}
					live={ status !== "idle" && status !== "error" }
				/>
			</section>
		</main>

		<footer className="relative px-6 py-5 text-center">
			<a
				href="#"
				className="text-xs text-stone-400 transition hover:text-stone-600"
			>
				Powered by Tin Can
			</a>
		</footer>
		<Dialog data={dialog} />
	</div>
}