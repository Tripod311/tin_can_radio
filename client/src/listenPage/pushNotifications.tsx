import { useState } from "react";
import usePush from "../hooks/usePush.js";

export default function PushNotifications() {
    const { ready, subscriptionInfo, subscribe, unsubscribe } = usePush();

    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const subscribed = subscriptionInfo?.subscribed ?? false;
    const supported = subscriptionInfo?.supported ?? false;
    const loading = !ready || pending;

    function handleClick() {
        if (loading || !supported) return;

        setPending(true);
        setError(null);

        const onSuccess = () => setPending(false);
        const onError = (err: any) => {
            setError(err instanceof Error ? err.message : String(err));
            setPending(false);
        };

        try {
            if (subscribed) {
                unsubscribe(onSuccess, onError);
            } else {
                subscribe(onSuccess, onError);
            }
        } catch (err) {
            onError(err);
        }
    }

    const label = !supported && ready
        ? "Push is not supported"
        : subscribed
            ? "Disable push notifications"
            : "Enable push notifications";

    return (
        <div>
            <button
                type="button"
                onClick={handleClick}
                disabled={loading || !supported}
                aria-label={label}
                title={label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full
                           text-current transition-colors hover:bg-white/10
                           disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
                {loading ? (
                    <span
                        aria-hidden="true"
                        className="h-5 w-5 animate-spin rounded-full border-2
                                   border-current border-t-transparent"
                    />
                ) : (
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                    >
                        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
                        <path d="M10 21h4" />
                        {!subscribed && <path d="M3 3l18 18" />}
                    </svg>
                )}
            </button>

            {error && (
                <p role="alert" className="mt-1 text-sm text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
}