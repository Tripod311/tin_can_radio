interface MediaFileProps {
    name: string;
    play: () => void;
    stop: () => void;
    onEnded: () => void;
}

export default function MediaFile({
    name,
    play,
    stop,
    onEnded
}: MediaFileProps) {
    return <li
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
                {name}
            </p>
        </div>
    </li>
}