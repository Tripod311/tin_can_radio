import ErrorDialog from "./errorDialog.js"
import Spinner from "./spinner.js"
import PasswordDialog from "./passwordDialog.js"

export interface DialogOptions {
	type: "spinner" | "error" | "password";
	options: Record<string, any>;
}

interface DialogProps {
    data: DialogOptions | null;
}

export default function Dialog({ data } : DialogProps) {
    if (data?.type === "spinner") return <Spinner />
    
    if (data?.type === "error") return <ErrorDialog
        message={data?.options.message}
        onClose={data?.options.onClose}
    />

    if (data?.type === "password") return <PasswordDialog
        onSubmit={data?.options.onSubmit}
        onCancel={data?.options.onCancel}
    />

    return null
}