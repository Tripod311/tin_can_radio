import {
	useCallback,
	useEffect,
	useRef,
	useState
} from "react"

const DEFAULT_ICE_SERVERS: RTCIceServer[] = []

type BroadcastStatus =
	| "idle"
	| "connecting"
	| "broadcasting"
	| "reconnecting"
	| "error"

function waitForIceGatheringComplete (
	peerConnection: RTCPeerConnection
) {
	if (peerConnection.iceGatheringState === "complete") {
		return Promise.resolve()
	}

	return new Promise<void>((resolve) => {
		function onStateChange () {
			if (peerConnection.iceGatheringState !== "complete") {
				return
			}

			peerConnection.removeEventListener(
				"icegatheringstatechange",
				onStateChange
			)

			resolve()
		}

		peerConnection.addEventListener(
			"icegatheringstatechange",
			onStateChange
		)
	})
}

export default function useBroadcastRTC (
	audioTrack: MediaStreamTrack | null,
	iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS
) {
	const peerConnectionRef = useRef<RTCPeerConnection>(null)

	const [ status, setStatus ] =
		useState<BroadcastStatus>("idle")

	const [ error, setError ] =
		useState<Error | null>(null)

	const stop = useCallback(() => {
		const peerConnection = peerConnectionRef.current

		peerConnectionRef.current = null
		peerConnection?.close()

		setStatus("idle")
	}, [])

	const start = useCallback(async () => {
		if (peerConnectionRef.current) {
			return
		}

		if (!audioTrack) {
			setError(new Error("Audio track is not available"))
			setStatus("error")
			return
		}

		setStatus("connecting")
		setError(null)

		const peerConnection = new RTCPeerConnection({
			iceServers
		})

		peerConnectionRef.current = peerConnection

		const stream = new MediaStream([ audioTrack ])

		peerConnection.addTransceiver(audioTrack, {
			direction: "sendonly",
			streams: [ stream ]
		})

		peerConnection.addEventListener(
			"connectionstatechange",
			() => {
				if (peerConnectionRef.current !== peerConnection) {
					return
				}

				switch (peerConnection.connectionState) {
					case "connected":
						setStatus("broadcasting")
						break

					case "disconnected":
						setStatus("reconnecting")
						break

					case "failed":
						setError(
							new Error("Broadcast connection failed")
						)
						setStatus("error")
						break

					case "closed":
						setStatus("idle")
						break
				}
			}
		)

		try {
			const offer = await peerConnection.createOffer()

			await peerConnection.setLocalDescription(offer)
			await waitForIceGatheringComplete(peerConnection)

			if (peerConnectionRef.current !== peerConnection) {
				return
			}

			const response = await fetch("/api/broadcast", {
				method: "POST",

				headers: {
					"Content-Type": "application/json"
				},

				body: JSON.stringify(
					peerConnection.localDescription
				)
			})

			if (!response.ok) {
				throw new Error(
					`Signaling failed: ${response.status}`
				)
			}

			const answer: RTCSessionDescriptionInit =
				await response.json()

			if (peerConnectionRef.current !== peerConnection) {
				return
			}

			await peerConnection.setRemoteDescription(answer)
		} catch (value: unknown) {
			// Если stop() уже закрыл это подключение,
			// результат старого async-сценария больше не нужен.
			if (peerConnectionRef.current !== peerConnection) {
				return
			}

			peerConnectionRef.current = null
			peerConnection.close()

			setError(
				value instanceof Error
					? value
					: new Error("Failed to start broadcast")
			)

			setStatus("error")
		}
	}, [ audioTrack, iceServers ])

	useEffect(() => {
		return stop
	}, [ stop ])

	return {
		status,
		error,

		broadcasting: status === "broadcasting",

		connecting:
			status === "connecting" ||
			status === "reconnecting",

		start,
		stop
	}
}