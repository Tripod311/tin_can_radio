import { useState } from "react"

import MediaFile from "./mediaFile.js"

interface MediaListProps {
    title: string;
}

export default function MediaList({ title }: MediaListProps) {
    const [ mediaFiles, setMediaFiles ] = useState<File[]>([]);

    return <section
        className="
            flex min-h-[32rem] flex-col
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
                    { title }
                </h1>
            </div>

            <label
                className="
                    shrink-0 cursor-pointer
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

        {mediaFiles.length === 0 ? (
            <div
                className="
                    flex flex-1
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
            <ul
                className="
                    max-h-[32rem]
                    space-y-2
                    overflow-y-auto
                    pr-1
                "
            >
                {mediaFiles.map((file, index) => (
                    <MediaFile
                        key={`${file.name}-${file.lastModified}-${index}`}
                        name={file.name}
                        play={() => {}}
                        stop={() => {}}
                        onEnded={() => {}}
                    />
                ))}
            </ul>
        )}
    </section>
}