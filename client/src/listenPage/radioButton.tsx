interface ButtonProps {
	live: boolean;
	toggleLive: () => void;
}

export default function RadioButton ({ live, toggleLive }: ButtonProps) {
	return <div className="mt-12 flex flex-col items-center gap-4">
		<button
			onClick={toggleLive}
			id="listen-button"
			type="button"
			aria-pressed="false"
			className="group flex h-36 w-36 flex-col items-center
				justify-center rounded-full bg-orange-600
				text-white shadow-xl shadow-orange-700/20
				transition duration-200
				hover:scale-[1.03] hover:bg-orange-500
				active:scale-[0.98]
				focus:outline-none focus:ring-4
				focus:ring-orange-300"
		>
			<svg
				id="listen-icon"
				className="mb-2 h-8 w-8 fill-current"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				{
					live
					? <path d="M7 5h4v14H7zm6 0h4v14h-4z"></path>
					: <path d="M8 5v14l11-7z"></path>
				}
			</svg>

			<span
				id="listen-label"
				className="text-sm font-semibold uppercase tracking-wider"
			>
				{
					live
					? "Stop listening"
					: "Listen"
				}
			</span>
		</button>

		<p
			id="listening-status"
			className="text-sm text-stone-400"
			aria-live="polite"
		>
			{
				live
				? "You are listening live"
				: "Readu to tune in"
			}
		</p>
	</div>
}