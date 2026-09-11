export default function Spinner () {
	return (
		<div
			role="status"
			aria-label="Loading"
			className="
				fixed inset-0 z-50
				flex items-center justify-center
				bg-black/50
			"
		>
			<div
				className="
					h-20 w-20
					animate-spin rounded-full
					border-4 border-rose-800
					border-t-rose-400
				"
			/>

			<span className="sr-only">Loading...</span>
		</div>
	)
}