import {
	useState,
	type SubmitEventHandler,
} from "react"

interface PasswordDialogProps {
	onSubmit: (password: string) => void
	onCancel: () => void
}

export default function PasswordDialog ({
	onSubmit,
	onCancel,
}: PasswordDialogProps) {
	const [password, setPassword] = useState("")

	const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
		event.preventDefault()

		const submittedPassword = password
		setPassword("")
		onSubmit(submittedPassword)
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Enter studio password"
			className="
				fixed inset-0 z-50
				flex items-center justify-center
				bg-black/50
				p-4
			"
		>
			<form
				onSubmit={handleSubmit}
				className="
					w-full max-w-md
					rounded-xl
					bg-white
					p-6
					text-slate-900
					shadow-xl
				"
			>
				<h2 className="mb-4 text-xl font-semibold">
					Enter studio
				</h2>

				<label
					htmlFor="studio-password"
					className="mb-2 block text-sm font-medium"
				>
					Password
				</label>

				<input
					id="studio-password"
					type="password"
					name="password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					autoComplete="current-password"
					autoFocus
					required
					className="
						mb-6
						w-full
						rounded-lg
						border border-slate-300
						px-3 py-2
						outline-none
						focus:border-rose-600
					"
				/>

				<div className="flex justify-end gap-3">
					<button
						type="button"
						onClick={onCancel}
						className="
							rounded-lg
							px-4 py-2
							text-slate-600
							hover:bg-slate-100
						"
					>
						Cancel
					</button>

					<button
						type="submit"
						className="
							rounded-lg
							bg-rose-800
							px-4 py-2
							text-white
							hover:bg-rose-700
						"
					>
						Enter
					</button>
				</div>
			</form>
		</div>
	)
}