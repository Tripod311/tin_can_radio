import {
	useEffect,
	useRef,
	useState
} from "react";

interface MediaFileProps {
	file: File;
	play: (track: MediaStreamTrack) => void;
	stop: () => void;
	onEnded: () => void;
}

function formatTime(seconds: number) {
	if (!Number.isFinite(seconds)) {
		return "0:00";
	}

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);

	return `${minutes}:${remainingSeconds
		.toString()
		.padStart(2, "0")}`;
}

export default function MediaFile({
	file,
	play,
	stop,
	onEnded
}: MediaFileProps) {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const contextRef = useRef<AudioContext | null>(null);
	const sourceRef =
		useRef<MediaElementAudioSourceNode | null>(null);
	const destinationRef =
		useRef<MediaStreamAudioDestinationNode | null>(null);
	const trackRef = useRef<MediaStreamTrack | null>(null);
	const onEndedRef = useRef(onEnded);

	const [ playing, setPlaying ] = useState(false);
	const [ currentTime, setCurrentTime ] = useState(0);
	const [ duration, setDuration ] = useState(0);

	useEffect(() => {
		onEndedRef.current = onEnded;
	}, [ onEnded ]);

	useEffect(() => {
		const url = URL.createObjectURL(file);
		const audio = new Audio(url);

		audio.preload = "metadata";
		audioRef.current = audio;

		function handleDurationChange() {
			setDuration(
				Number.isFinite(audio.duration)
					? audio.duration
					: 0
			);
		}

		function handleTimeUpdate() {
			setCurrentTime(audio.currentTime);
		}

		function handleEnded() {
			setPlaying(false);
			setCurrentTime(audio.duration);
			onEndedRef.current();
		}

		audio.addEventListener(
			"durationchange",
			handleDurationChange
		);

		audio.addEventListener(
			"timeupdate",
			handleTimeUpdate
		);

		audio.addEventListener(
			"ended",
			handleEnded
		);

		return () => {
			audio.pause();

			audio.removeEventListener(
				"durationchange",
				handleDurationChange
			);

			audio.removeEventListener(
				"timeupdate",
				handleTimeUpdate
			);

			audio.removeEventListener(
				"ended",
				handleEnded
			);

			sourceRef.current?.disconnect();
			destinationRef.current?.disconnect();
			trackRef.current?.stop();

			if (
				contextRef.current &&
				contextRef.current.state !== "closed"
			) {
				void contextRef.current.close();
			}

			audio.removeAttribute("src");
			audio.load();

			URL.revokeObjectURL(url);

			audioRef.current = null;
			contextRef.current = null;
			sourceRef.current = null;
			destinationRef.current = null;
			trackRef.current = null;
		};
	}, [ file ]);

	function getOutputTrack() {
		if (trackRef.current) {
			return trackRef.current;
		}

		const audio = audioRef.current;

		if (!audio) {
			throw new Error("Audio file is not initialized");
		}

		const context = new AudioContext();
		const source = context.createMediaElementSource(audio);
		const destination =
			context.createMediaStreamDestination();

		source.connect(destination);

		const [ track ] =
			destination.stream.getAudioTracks();

		contextRef.current = context;
		sourceRef.current = source;
		destinationRef.current = destination;
		trackRef.current = track ?? null;

		return track;
	}

	async function handlePlay() {
		const audio = audioRef.current;

		if (!audio) {
			return;
		}

		const track = getOutputTrack();
		const context = contextRef.current;

		if (context?.state === "suspended") {
			await context.resume();
		}

		play(track as MediaStreamTrack);

		await audio.play();

		setPlaying(true);
	}

	function handleStop() {
		const audio = audioRef.current;

		if (audio) {
			audio.pause();
			audio.currentTime = 0;
		}

		setPlaying(false);
		setCurrentTime(0);

		stop();
	}

	const progress = duration > 0
		? Math.min((currentTime / duration) * 100, 100)
		: 0;

	return (
		<li
			className="
				overflow-hidden
				rounded-xl
				border border-stone-200
				bg-white
			"
		>
			<div className="flex items-center gap-3 px-4 py-3">
				<button
					type="button"
					onClick={() => {
						if (playing) {
							handleStop();
						} else {
							void handlePlay();
						}
					}}
					aria-label={
						playing
							? `Stop ${file.name}`
							: `Play ${file.name}`
					}
					className="
						flex h-9 w-9 shrink-0
						items-center justify-center
						rounded-full
						bg-amber-100
						text-sm text-amber-800
						transition
						hover:bg-amber-200
						focus:outline-none
						focus:ring-2
						focus:ring-amber-400
					"
				>
					{playing ? "■" : "▶"}
				</button>

				<div className="min-w-0 flex-1">
					<p
						className="
							truncate
							text-sm font-medium
							text-stone-800
						"
					>
						{file.name}
					</p>

					<p className="mt-1 text-xs text-stone-400">
						{formatTime(currentTime)}
						{" / "}
						{formatTime(duration)}
					</p>
				</div>
			</div>

			<div className="h-1 w-full bg-stone-100">
				<div
					className="
						h-full
						bg-rose-700
						transition-[width]
						duration-200
					"
					style={{
						width: `${progress}%`
					}}
				/>
			</div>
		</li>
	);
}