import {
	useCallback,
	useEffect,
	useRef,
	useState
} from "react"

function waitForIceGatheringComplete (peerConnection: RTCPeerConnection) {
	if (peerConnection.iceGatheringState === "complete") {
		return Promise.resolve();
	}

	return new Promise<void>(resolve => {
		function onStateChange () {
			if (peerConnection.iceGatheringState !== "complete") {
				return;
			}

			peerConnection.removeEventListener(
				"icegatheringstatechange",
				onStateChange
			);

			resolve();
		}

		peerConnection.addEventListener(
			"icegatheringstatechange",
			onStateChange
		);
	});
}

export default function useRTC (iceServers: RTCIceServer[] = []) {
	const peerConnectionRef = useRef<RTCPeerConnection>(null);
	const audioRef = useRef<HTMLAudioElement>(null);

	const [ status, setStatus ] = useState("idle");
	const [ error, setError ] = useState(null);

	const stop = useCallback(() => {
		if (peerConnectionRef.current) {
			peerConnectionRef.current.close();
			peerConnectionRef.current = null;
		}

		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.srcObject = null;
		}

		setStatus("idle");
	}, []);

	const start = useCallback(async () => {
		if (peerConnectionRef.current) {
			return;
		}

		setStatus("connecting");
		setError(null);

		const peerConnection = new RTCPeerConnection({
			iceServers
		});

		peerConnectionRef.current = peerConnection;

		peerConnection.addTransceiver("audio", {
			direction: "recvonly"
		});

		peerConnection.addEventListener(
			"connectionstatechange",
			() => {
				switch (peerConnection.connectionState) {
					case "connected":
						setStatus("listening");
						break;

					case "disconnected":
						setStatus("reconnecting");
						break;

					case "failed":
						setStatus("error");
						break;

					case "closed":
						setStatus("idle");
						break;
				}
			}
		);

		peerConnection.addEventListener(
			"track",
			async event => {
				const [ stream ] = event.streams;

				if (!audioRef.current) {
					return;
				}

				audioRef.current.srcObject =
					stream ?? new MediaStream([ event.track ]);

				try {
					await audioRef.current.play();
				} catch (error: any) {
					setError(error);
					setStatus("error");
				}
			}
		);

		try {
			const offer = await peerConnection.createOffer();

			await peerConnection.setLocalDescription(offer);
			await waitForIceGatheringComplete(peerConnection);

			const response = await fetch("/api/listen", {
				method: "POST",

				headers: {
					"Content-Type": "application/json"
				},

				body: JSON.stringify(
					peerConnection.localDescription
				)
			});

			if (!response.ok) {
				throw new Error(
					`Signaling failed: ${response.status}`
				);
			}

			const answer = await response.json();

			await peerConnection.setRemoteDescription(answer);
		} catch (error: any) {
			peerConnection.close();
			peerConnectionRef.current = null;

			setError(error);
			setStatus("error");
		}
	}, [ iceServers ]);

	useEffect(() => {
		return stop;
	}, [ stop ]);

	return {
		audioRef,
		status,
		error,

		listening: status === "listening",
		connecting:
			status === "connecting" ||
			status === "reconnecting",

		start,
		stop
	};
}