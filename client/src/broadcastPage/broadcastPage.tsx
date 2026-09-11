import { useState } from "react";

interface BroadcastPageProps {
	onLeave: () => void;
}

export default function BroadcastPage ({
	onLeave
}: BroadcastPageProps) {
	const [ mediaFiles, setMediaFiles ] = useState<File[]>([]);
	const [ nowPlaying, setNowPlaying ] = useState("");

	return (
		<div className="relative flex min-h-screen flex-col overflow-hidden">
			<div
				className="
					pointer-events-none
					absolute left-1/2 top-1/2
					h-[32rem] w-[32rem]
					-translate-x-1/2 -translate-y-1/2
					rounded-full
					bg-amber-200/30
					blur-3xl
				"
			></div>

			<header className="relative flex justify-end p-5 sm:p-8">
				<button
					type="button"
					onClick={onLeave}
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
						md:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]
					"
				>
					<section
						className="
							flex min-h-[30rem] flex-col
							rounded-2xl
							border border-stone-200
							bg-white/70
							p-6
							shadow-sm
							backdrop-blur
						"
					>
						<div className="mb-6 flex items-center justify-between gap-4">
							<div>
								<h1 className="text-xl font-semibold text-stone-900">
									Media
								</h1>

								<p className="mt-1 text-sm text-stone-500">
									Audio files and jingles for this session
								</p>
							</div>

							<label
								className="
									cursor-pointer
									rounded-full
									bg-rose-800
									px-4 py-2
									text-sm font-medium text-white
									transition
									hover:bg-rose-700
									focus-within:ring-2
									focus-within:ring-rose-400
								"
							>
								Add media

								<input
									type="file"
									accept="audio/*"
									multiple
									className="sr-only"
									onChange={(event) => {
										const files = Array.from(
											event.target.files ?? []
										);

										setMediaFiles((current) => [
											...current,
											...files
										]);

										event.target.value = "";
									}}
								/>
							</label>
						</div>

						<div className="flex-1">
							{mediaFiles.length === 0 ? (
								<div
									className="
										flex h-full min-h-64
										items-center justify-center
										rounded-xl
										border-2 border-dashed border-stone-200
										px-6
										text-center text-sm text-stone-400
									"
								>
									No media added
								</div>
							) : (
								<ul className="space-y-2">
									{mediaFiles.map((file, index) => (
										<li
											key={`${file.name}-${file.lastModified}-${index}`}
											className="
												flex items-center gap-3
												rounded-xl
												border border-stone-200
												bg-white
												px-4 py-3
											"
										>
											<div
												className="
													flex h-9 w-9 shrink-0
													items-center justify-center
													rounded-full
													bg-amber-100
													text-sm text-amber-800
												"
											>
												▶
											</div>

											<div className="min-w-0">
												<p
													className="
														truncate
														text-sm font-medium
														text-stone-800
													"
												>
													{file.name}
												</p>

												<p className="text-xs text-stone-400">
													{(file.size / 1024 / 1024).toFixed(1)} MB
												</p>
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					</section>

					<section
						className="
							flex flex-col
							rounded-2xl
							border border-stone-200
							bg-white/70
							p-6
							shadow-sm
							backdrop-blur
						"
					>
						<h2 className="text-xl font-semibold text-stone-900">
							Broadcast
						</h2>

						<form
							className="mt-6"
							onSubmit={(event) => {
								event.preventDefault();
							}}
						>
							<label
								htmlFor="now-playing"
								className="mb-2 block text-sm font-medium text-stone-700"
							>
								Now playing
							</label>

							<input
								id="now-playing"
								type="text"
								value={nowPlaying}
								onChange={(event) => {
									setNowPlaying(event.target.value);
								}}
								placeholder="Artist — Track"
								className="
									w-full
									rounded-xl
									border border-stone-300
									bg-white
									px-4 py-3
									text-stone-900
									outline-none
									transition
									placeholder:text-stone-400
									focus:border-rose-600
									focus:ring-2
									focus:ring-rose-200
								"
							/>
						</form>

						<div className="mt-8 flex flex-1 items-center justify-center">
							<button
								type="button"
								className="
									flex h-36 w-36
									items-center justify-center
									rounded-full
									bg-rose-800
									px-6
									text-center
									text-sm font-semibold text-white
									shadow-lg
									transition
									hover:scale-105
									hover:bg-rose-700
									focus:outline-none
									focus:ring-4
									focus:ring-rose-300
								"
							>
								Capture microphone
							</button>
						</div>
					</section>
				</div>
			</main>
		</div>
	);
}