import { useState, useRef } from "react";

export default function useRecorder() {
	const [ recording, setRecording ] = useState(false);
	const [ error, setError ] = useState<Error | undefined>();

	const recorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);

	const completionRef = useRef<Promise<Blob> | null>(null);
	const resolveRef = useRef<((blob: Blob) => void) | null>(null);

	function start(stream: MediaStream) {
		if (
			recorderRef.current !== null &&
			recorderRef.current.state !== "inactive"
		) {
			return;
		}

		try {
			const recorder = new MediaRecorder(stream);

			chunksRef.current = [];
			setError(undefined);

			completionRef.current = new Promise<Blob>(resolve => {
				resolveRef.current = resolve;
			});

			recorder.addEventListener("dataavailable", event => {
				if (event.data.size > 0) {
					chunksRef.current.push(event.data);
				}
			});

			recorder.addEventListener("stop", () => {
				const blob = new Blob(chunksRef.current, {
					type: recorder.mimeType
				});

				chunksRef.current = [];
				setRecording(false);

				resolveRef.current?.(blob);
				resolveRef.current = null;
			});

			recorder.addEventListener("error", () => {
				setError(new Error("MediaRecorder error"));
			});

			recorderRef.current = recorder;
			recorder.start();

			setRecording(true);
		} catch (error) {
			setError(
				error instanceof Error
					? error
					: new Error("Failed to start recording")
			);
		}
	}

	async function stop(): Promise<Blob> {
		const recorder = recorderRef.current;
		const completion = completionRef.current;

		if (recorder === null || completion === null) {
			throw new Error("Recording not started");
		}

		if (recorder.state !== "inactive") {
			recorder.stop();
		}

		return completion;
	}

	function getExtension(): string {
		const recorder = recorderRef.current;

		if (recorder === null) {
			throw new Error("Recording not started");
		}

		if (recorder.state !== "inactive") {
			throw new Error("Recording is not finished");
		}

		const type = recorder.mimeType.split(";")[0];

		switch (type) {
			case "audio/webm":
				return "webm";

			case "audio/ogg":
				return "ogg";

			case "audio/mp4":
				return "m4a";

			default:
				return "audio";
		}
	}

	return {
		recording,
		error,
		start,
		stop,
		getExtension
	};
}