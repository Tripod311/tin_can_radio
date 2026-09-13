import { useState, useEffect } from "react"

interface SubscriptionInfo {
    supported: boolean;
    subscribed: boolean;
    permission?: string;
    subscription: PushSubscription | null;
}

function urlBase64ToUint8Array(base64String: string) {
	const padding = '='.repeat((4 - base64String.length % 4) % 4);
	const base64 = (base64String + padding)
		.replace(/-/g, '+')
		.replace(/_/g, '/');

	const rawData = atob(base64);
	return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function push_unsubscribe(endpoint: string) {
    const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            endpoint: endpoint
        })
    })

    if (!response.ok) {
        throw new Error(`Unsubscribe error: ${ await response.text() }`);
    }
}

async function push_subscribe(): Promise<PushSubscription> {
	if (!('serviceWorker' in navigator)) {
        throw new Error("Service worker is undefined");
    };
	if (!('PushManager' in window)) {
        throw new Error("PushManager is undefined");
    };

	const registration = await navigator.serviceWorker.register('/sw.js', {
		updateViaCache: 'none'
	});

	const existing = await registration.pushManager.getSubscription();

	if (existing) {
		return existing;
	}

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') {
        throw new Error("Permission is not granted");
    };

    const vapid_response = await fetch('/api/push/vapid');

    if (!vapid_response.ok) {
        throw new Error(`Error on fetching vapid key`);
    }

    const vapid_key = await vapid_response.text();

	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(vapid_key)
	});

	const subscribeResponse = await fetch('/api/push/subscribe', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(subscription)
	});

    if (!subscribeResponse.ok) {
        throw new Error(`Subscribe error: ${await subscribeResponse.text()}`)
    }

	return subscription;
}

async function getPushStatus(): Promise<SubscriptionInfo> {
	if (!('serviceWorker' in navigator)) {
		return { supported: false, subscribed: false, subscription: null };
	}

	const permission = Notification.permission;

	const registration = await navigator.serviceWorker.getRegistration();

	if (!registration) {
		return {
			supported: true,
			permission: permission,
			subscribed: false,
            subscription: null
		};
	}

	const subscription = await registration.pushManager.getSubscription();

	return {
		supported: true,
		permission: permission,
		subscribed: !!subscription,
		subscription: subscription
	};
}

export default function usePush () {
    const [ ready, setReady ] = useState(false);
    const [ subscriptionInfo, setSubscriptionInfo ] = useState<SubscriptionInfo>({
        supported: false,
        subscribed: false,
        subscription: null
    });

    useEffect(() => {
        getPushStatus().then((info: SubscriptionInfo) => {
            setSubscriptionInfo(info);
            setReady(true);
        });
    }, []);

    const subscribe = async (onSucccess?: () => void, onError?: (err: any) => void) => {
        if (!subscriptionInfo.supported) {
            onError && onError("Push is not supported")
            return;
        }

        if (subscriptionInfo.subscribed) {
            onSucccess && onSucccess();
            return;
        }

        try {
            await push_subscribe();
            setSubscriptionInfo(await getPushStatus());
            onSucccess && onSucccess();
        } catch (err: any) {
            onError && onError(`Error occured: ${err.toString()}`);
        }
    };

    const unsubscribe = async (onSucccess?: () => void, onError?: (err: any) => void) => {
        if (!subscriptionInfo.supported) {
            onError && onError("Push is not supported")
            return;
        }

        if (!subscriptionInfo.subscribed) {
            onSucccess && onSucccess();
            return;
        }

        try {
            await push_unsubscribe(subscriptionInfo.subscription!.toJSON().endpoint as string);
            await subscriptionInfo.subscription!.unsubscribe();
            setSubscriptionInfo(await getPushStatus());
            onSucccess && onSucccess();
        } catch (err: any) {
            onError && onError(`Error occured: ${err.toString()}`);
        }
    };

    return {
        ready,
        subscriptionInfo,
        subscribe,
        unsubscribe
    }
}