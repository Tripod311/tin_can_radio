import { useRef, useEffect } from "react";

export default function useAudioDestination() {
	const contextRef = useRef<AudioContext | null>(null);
	const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
	const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

	useEffect(() => {
		return () => {
			sourceRef.current?.disconnect();

			const context = contextRef.current;

			sourceRef.current = null;
			destinationRef.current = null;
			contextRef.current = null;

			if (context !== null && context.state !== "closed") {
				void context.close();
			}
		};
	}, []);

	function getGraph() {
		if (
			contextRef.current === null ||
			destinationRef.current === null
		) {
			const context = new AudioContext();
			const destination = context.createMediaStreamDestination();

			contextRef.current = context;
			destinationRef.current = destination;
		}

		return {
			context: contextRef.current,
			destination: destinationRef.current
		};
	}

	async function setSource(
		track: MediaStreamTrack
	): Promise<MediaStream> {
		if (track.kind !== "audio") {
			throw new Error("Audio track expected");
		}

		if (track.readyState === "ended") {
			throw new Error("Audio track has ended");
		}

		const { context, destination } = getGraph();

		const stream = new MediaStream([track]);
		const newSource = context.createMediaStreamSource(stream);

		sourceRef.current?.disconnect();

		newSource.connect(destination);
		sourceRef.current = newSource;

		if (context.state === "suspended") {
			await context.resume();
		}

		return destination.stream;
	}

	function clearSource() {
		sourceRef.current?.disconnect();
		sourceRef.current = null;
	}

	return {
		destinationRef,
		setSource,
		clearSource
	};
}