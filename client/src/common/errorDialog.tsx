interface ErrorDialogProps {
	message: string
	onClose: () => void
}

export default function ErrorDialog ({
	message,
	onClose,
}: ErrorDialogProps) {
	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Error"
			className="
				fixed inset-0 z-50
				flex items-center justify-center
				bg-black/50
				p-4
			"
		>
			<div
				className="
					w-full max-w-md
					rounded-xl
					bg-white
					p-6
					text-slate-900
					shadow-xl
				"
			>
				<h2 className="mb-3 text-xl font-semibold">
					Error
				</h2>

				<p className="mb-6 whitespace-pre-wrap text-slate-700">
					{message}
				</p>

				<div className="flex justify-end">
					<button
						type="button"
						onClick={onClose}
						autoFocus
						className="
							rounded-lg
							bg-rose-800
							px-4 py-2
							text-white
							hover:bg-rose-700
						"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	)
}